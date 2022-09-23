package scheduler

import (
	"fmt"
	"os"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/schema"
	"r3/tools"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
)

var oneDayInSeconds int64 = 60 * 60 * 24

// deletes files older than 1 day from temporary directory
func cleanupTemp() error {
	files, err := os.ReadDir(config.File.Paths.Temp)
	if err != nil {
		return err
	}

	for _, file := range files {
		filePath := filepath.Join(config.File.Paths.Temp, file.Name())

		fileInfo, err := os.Stat(filePath)
		if err != nil {
			return err
		}

		if fileInfo.IsDir() || fileInfo.ModTime().Unix()+oneDayInSeconds > tools.GetTimeUnix() {
			continue
		}

		if err := os.Remove(filePath); err != nil {
			continue
		}
	}
	return nil
}

// deletes expired logs
func cleanupLogs() error {

	keepForDays := config.GetUint64("logsKeepDays")
	if keepForDays == 0 {
		return nil
	}

	deleteOlderMilli := (tools.GetTimeUnix() - (oneDayInSeconds * int64(keepForDays))) * 1000

	if _, err := db.Pool.Exec(db.Ctx, `
		DELETE FROM instance.log
		WHERE date_milli < $1
	`, deleteOlderMilli); err != nil {
		return err
	}
	return nil
}

// removes files that were deleted from their attribute or that are not assigned to a record
func cleanUpFiles() error {

	attributeIdsFile := make([]uuid.UUID, 0)
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT ARRAY_AGG(id)
		FROM app.attribute
		WHERE content = 'files'
	`).Scan(&attributeIdsFile); err != nil {
		return err
	}

	for _, atrId := range attributeIdsFile {
		tNameF := schema.GetFilesTableName(atrId)
		tNameR := schema.GetFilesTableNameRecords(atrId)
		tNameV := schema.GetFilesTableNameVersions(atrId)

		fileIds := make([]uuid.UUID, 0)
		limit := 100 // at most 100 entries at a time
		now := tools.GetTimeUnix()

		// delete assignments if deleted too far in the past
		_, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
			DELETE FROM instance_file."%s"
			WHERE date_delete IS NOT NULL
			AND   date_delete < $1
		`, tNameR), now-(oneDayInSeconds*int64(config.GetUint64("filesKeepDaysDeleted"))))
		if err != nil {
			return err
		}

		// find files that have no more record assignments
		// execute in steps to reduce memory load
		for {
			if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
				SELECT ARRAY_AGG(f.id)
				FROM instance_file."%s" AS f
				WHERE 0 = (
					SELECT COUNT(*)
					FROM instance_file."%s" AS r
					WHERE r.file_id = f.id
				)
				LIMIT $1
			`, tNameF, tNameR), limit).Scan(&fileIds); err != nil {
				return err
			}

			if len(fileIds) == 0 {
				break
			}

			for _, fileId := range fileIds {

				versions := make([]int64, 0)
				if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
					SELECT ARRAY_AGG(version)
					FROM instance_file."%s"
					WHERE file_id = $1
				`, tNameV), fileId).Scan(&versions); err != nil {
					return err
				}

				for _, version := range versions {
					filePath := data.GetFilePathVersion(atrId, fileId, version)

					exists, err := tools.Exists(filePath)
					if err != nil {
						return err
					}
					if !exists {
						// file not available, skip and continue
						continue
					}

					// referenced file version exists, attempt to delete it
					// if deletion fails, abort and keep its reference as file might be in access
					if err := os.Remove(filePath); err != nil {
						log.Warning("server", "failed to remove old file version", err)
						continue
					}

					// either file version existed on disk and could be deleted or it didn´t exist
					// either case we delete the file reference
					if _, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
							DELETE FROM instance_file."%s"
							WHERE file_id = $1
							AND   version = $2
						`, tNameV), fileId, version); err != nil {
						return err
					}
				}

				// clean up thumbnail, if there
				filePathThumb := data.GetFilePathThumb(atrId, fileId)
				if exists, _ := tools.Exists(filePathThumb); exists {
					if err := os.Remove(filePathThumb); err != nil {
						log.Warning("server", "failed to remove old file thumbnail", err)
						continue
					}
				}
			}

			// delete file records with no versions left
			tag, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
				DELETE FROM instance_file."%s" AS f
				WHERE 0 = (
					SELECT COUNT(*)
					FROM instance_file."%s"
					WHERE file_id = f.id
				)
			`, tNameF, tNameV))
			if err != nil {
				return err
			}

			// if not a single file was deleted this loop, nothing more we can do
			if tag.RowsAffected() == 0 {
				break
			}
			log.Info("server", fmt.Sprintf("successfully cleaned up %d files (deleted/unassigned)",
				tag.RowsAffected()))

			// limit not reached this loop, we are done
			if len(fileIds) < limit {
				break
			}
		}

		// find file versions that do not fulfill the relation retention settings
		cache.Schema_mx.RLock()
		atr, exists := cache.AttributeIdMap[atrId]
		if !exists {
			cache.Schema_mx.RUnlock()
			return handler.ErrSchemaUnknownAttribute(atrId)
		}
		rel, exists := cache.RelationIdMap[atr.RelationId]
		if !exists {
			cache.Schema_mx.RUnlock()
			return handler.ErrSchemaUnknownRelation(atr.RelationId)
		}
		cache.Schema_mx.RUnlock()

		type fileVersion struct {
			fileId  uuid.UUID
			version int64
		}

		for {
			removeCnt := 0
			fileVersions := make([]fileVersion, 0)

			var keepVersionsCnt int32 = 0
			if rel.RetentionCount.Status == pgtype.Present {
				keepVersionsCnt = rel.RetentionCount.Int
			}

			var keepVersionsAfter int64 = now
			if rel.RetentionDays.Status == pgtype.Present {
				keepVersionsAfter = now - (int64(rel.RetentionDays.Int) * 86400)
			}

			rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
				SELECT v.file_id, v.version
				FROM instance_file."%s" AS v
				
				-- never touch the latest version
				WHERE v.version <> (
					SELECT MAX(s.version)
					FROM instance_file."%s" AS s
					WHERE s.file_id = v.file_id
				)
				
				-- retention count not fulfilled
				AND (
					SELECT COUNT(*) AS newer_version_cnt
					FROM instance_file."%s" AS c
					WHERE c.file_id = v.file_id
					AND   c.version > v.version
				) > $1
				
				-- retention days not fulfilled
				AND v.date_change < $2
				
				ORDER BY file_id ASC, version DESC
				LIMIT $3
			`, tNameV, tNameV, tNameV), keepVersionsCnt, keepVersionsAfter, limit)

			if err != nil {
				return err
			}
			for rows.Next() {
				var fv fileVersion
				if err := rows.Scan(&fv.fileId, &fv.version); err != nil {
					return err
				}
				fileVersions = append(fileVersions, fv)
			}
			rows.Close()

			for _, fv := range fileVersions {
				filePath := data.GetFilePathVersion(atrId, fv.fileId, fv.version)

				// if file version exists, attempt to delete it
				// if not, skip deletion and remove reference
				if exists, _ := tools.Exists(filePath); exists {

					// if deletion fails, abort and keep its reference as file might be in access
					if err := os.Remove(filePath); err != nil {
						log.Warning("server", "failed to remove old file version", err)
						continue
					}
				}

				if _, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
						DELETE FROM instance_file."%s"
						WHERE file_id = $1
						AND   version = $2
					`, tNameV), fv.fileId, fv.version); err != nil {
					return err
				}
				removeCnt++
			}

			// if not a single file version was deleted this loop, nothing more we can do
			if removeCnt == 0 {
				break
			}

			log.Info("server", fmt.Sprintf("successfully cleaned up %d file versions (no retention)",
				removeCnt))

			// limit not reached this loop, we are done
			if len(fileVersions) < limit {
				break
			}
		}
	}
	return nil
}
