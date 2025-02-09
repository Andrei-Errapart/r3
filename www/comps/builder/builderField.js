import MyBuilderCaption          from './builderCaption.js';
import MyBuilderFields           from './builderFields.js';
import {MyBuilderColumns}        from './builderColumns.js';
import {isAttributeRelationship} from '../shared/attribute.js';
import {getFieldIcon}            from '../shared/field.js';
import {getFlexBasis}            from '../shared/form.js';
import {
	getFieldHasQuery,
	getItemTitle
} from '../shared/builder.js';
import {
	getJoinsIndexMap,
	getQueryExpressions,
	getQueryFiltersProcessed,
	getRelationsJoined
} from '../shared/query.js';
export {MyBuilderField as default};

let MyBuilderField = {
	name:'my-builder-field',
	components:{
		MyBuilderCaption,
		MyBuilderColumns
	},
	template:`<div class="builder-field"
		v-show="show"
		:class="cssClass"
		:key="field.id"
		:style="cssStyleParent"
	>
		<div class="builder-field-header" :class="{ dragAnchor:!moveActive && !noMovement }">
			<!-- field icon -->
			<div class="builder-field-button"
				@click="openSettings"
				:class="{ clickable:!isTemplate && !moveActive, selected:isSelected }"
				:title="capApp.fieldOptions"
			>
				<img :src="'images/' + getFieldIcon(field)" />
				<span>{{ reference }}</span>
			</div>
			
			<!-- warnings -->
			<img class="action warning clickable" src="images/warning.png"
				v-if="!isTemplate && !moveActive && warnings.length !== 0"
				@click="showWarnings"
				:title="capGen.warnings"
			/>
			
			<!-- container actions 1 -->
			<template v-if="!isTemplate && !moveActive && isContainer">
				<img class="action clickable"
					@click="$emit('field-property-set','direction',toggleDir(field.direction))"
					@click.prevent.right="$emit('field-property-set','direction',toggleDir(field.direction))"
					:src="field.direction === 'row' ? 'images/flexRow.png' : 'images/flexColumn.png'"
					:title="capApp.fieldDirection+': '+field.direction"
				/>
				
				<img class="action clickable"
					@click="$emit('field-property-set','wrap',toggleBool(field.wrap))"
					@click.prevent.right="$emit('field-property-set','wrap',toggleBool(field.wrap))"
					:src="field.wrap ? 'images/wrap1.png' : 'images/wrap0.png'"
					:title="capApp.flexWrap+': '+field.wrap"
				/>
			</template>
			
			<!-- action: edit field content -->
			<img class="action clickable" src="images/database.png"
				v-if="!isTemplate && !moveActive && hasQuery"
				@click="$emit('field-id-show',field.id,'content')"
				:class="{ selected:isSelected && fieldIdShowTab === 'content' }"
				:title="capApp.contentField"
			/>
			
			<!-- display: field is hidden -->
			<img class="action clickable" src="images/visible0.png"
				v-if="!isTemplate && !moveActive && field.state === 'hidden'"
				@click="$emit('field-property-set','state','default')"
				:title="capApp.hidden"
			/>
			
			<!-- action: move this field -->
			<img class="action mover"
				v-if="!noMovement && (!moveActive || fieldMoveList[fieldMoveIndex].id === field.id || !isTemplate)"
				@click="$emit('field-move',null,false)"
				:class="{ 'on-hover':!moveActive, selected:moveActive && fieldMoveList[fieldMoveIndex].id === field.id }"
				:src="!moveActive ? 'images/arrowRight.png' : 'images/arrowDown.png'"
				:title="!moveActive ? capApp.fieldMoveSource : capApp.fieldMoveTarget"
			/>
			
			<!-- action: move target inside container -->
			<img class="action clickable" src="images/arrowInside.png"
				v-if="!isTemplate && ['container','tabs'].includes(field.content) && moveActive && fieldMoveList[fieldMoveIndex].id !== field.id"
				@click="$emit('field-move',parentChildren,true)"
				:title="capApp.fieldMoveInside"
			/>
			
			<!-- mouse over break out actions -->
			<div v-if="!isTemplate && !moveActive" class="break-out-wrap on-hover">
				<div class="break-out shade">
					
					<!-- toggle: show on mobile -->
					<img class="action clickable"
						v-if="!moveActive"
						@click="$emit('field-property-set','onMobile',toggleBool(field.onMobile))"
						:src="field.onMobile ? 'images/smartphone.png' : 'images/smartphoneOff.png'"
						:title="capApp.onMobile+': '+field.onMobile"
					/>
					
					<!-- container actions 2 -->
					<template v-if="!moveActive && isContainer">
						<div class="clickable"
							@click="$emit('field-property-set','basis',toggleSize(field.basis,50,300))"
							@click.prevent.right="$emit('field-property-set','basis',toggleSize(field.basis,-50))"
							:title="capApp.flexSize"
						>
							<span>{{ getFlexBasis(field.basis) }}</span>
						</div>
						
						<div class="clickable"
							@click="$emit('field-property-set','grow',toggleSize(field.grow,1,1))"
							@click.prevent.right="$emit('field-property-set','grow',toggleSize(field.grow,-1))"
							:title="capApp.flexSizeGrow"
						>
							<span>G{{ field.grow }}</span>
						</div>
						
						<div class="clickable"
							@click="$emit('field-property-set','shrink',toggleSize(field.shrink,1,1))"
							@click.prevent.right="$emit('field-property-set','shrink',toggleSize(field.shrink,-1))"
							:title="capApp.flexSizeShrink"
						>
							<span>S{{ field.shrink }}</span>
						</div>
					</template>
					
					<!-- action: list data SQL preview -->
					<img class="action clickable" src="images/code.png"
						v-if="['calendar','chart','kanban','list'].includes(field.content)"
						@click="getSqlPreview(field)"
						:title="capApp.sql"
					/>
					
					<!-- field title -->
					<my-builder-caption
						v-if="isButton || isData || (isHeader && !field.richtext)"
						v-model="field.captions.fieldTitle"
						:contentName="title"
						:dynamicSize="true"
						:language="builderLanguage"
					/>
					
					<!-- action: remove field -->
					<img class="action on-hover end clickable" src="images/delete.png"
						@click="$emit('field-remove',field.id)"
					/>
				</div>
			</div>
			
			<span class="title"
				v-if="isTemplate || !isContainer" :title="title"
				:class="{ 'no-hover':!isTemplate }"
			>{{ title }}</span>
		</div>
		
		<!-- tabs -->
		<div class="builder-tabs" v-if="!isTemplate && isTabs">
			<div class="entries">
				<div class="entry"
					v-for="(t,i) in field.tabs"
					@click="tabIndex = i"
					:class="{ active:tabIndexShown === i }"
				>
					T{{ typeof entityIdMapRef.tab[t.id] !== 'undefined' ? entityIdMapRef.tab[t.id] : '' }}
				</div>
			</div>
			<my-builder-fields class="fields-nested column"
				v-for="(t,i) in field.tabs.filter((v,i) => tabIndexShown === i )"
				@column-id-show="(...args) => $emit('column-id-show',...args)"
				@field-counter-set="$emit('field-counter-set',$event)"
				@field-id-show="(...args) => $emit('field-id-show',...args)"
				@field-remove="$emit('field-remove',$event)"
				@field-move-store="$emit('field-move-store',$event)"
				:builderLanguage="builderLanguage"
				:columnIdShow="columnIdShow"
				:dataFields="dataFields"
				:entityIdMapRef="entityIdMapRef"
				:fieldCounter="fieldCounter"
				:fieldIdShow="fieldIdShow"
				:fieldIdShowTab="fieldIdShowTab"
				:fieldMoveList="fieldMoveList"
				:fieldMoveIndex="fieldMoveIndex"
				:fields="t.fields"
				:flexDirParent="'column'"
				:formId="formId"
				:isTemplate="false"
				:joinsIndexMap="joinsIndexMap"
				:moduleId="moduleId"
				:showColumnsAll="showColumnsAll"
				:uiScale="uiScale"
			/>
		</div>
		
		<!-- columns -->
		<my-builder-columns
			v-if="showColumns"
			@column-id-show="$emit('column-id-show',field.id,$event)"
			@columns-set="$emit('field-property-set','columns',$event)"
			:batchIndexTitle="columnBatchIndexTitle"
			:builderLanguage="builderLanguage"
			:columns="field.columns"
			:columnIdShow="columnIdShow"
			:groupName="field.id+'_columns'"
			:hasCaptions="isList"
		/>
		
		<!-- nested fields in container -->
		<my-builder-fields class="fields-nested"
			v-if="!isTemplate && isContainer"
			@column-id-show="(...args) => $emit('column-id-show',...args)"
			@field-counter-set="$emit('field-counter-set',$event)"
			@field-id-show="(...args) => $emit('field-id-show',...args)"
			@field-remove="$emit('field-remove',$event)"
			@field-move-store="$emit('field-move-store',$event)"
			:builderLanguage="builderLanguage"
			:class="cssClassChildren"
			:columnIdShow="columnIdShow"
			:dataFields="dataFields"
			:entityIdMapRef="entityIdMapRef"
			:fieldCounter="fieldCounter"
			:fieldIdShow="fieldIdShow"
			:fieldIdShowTab="fieldIdShowTab"
			:fieldMoveList="fieldMoveList"
			:fieldMoveIndex="fieldMoveIndex"
			:fields="field.fields"
			:flexDirParent="field.direction"
			:formId="formId"
			:isTemplate="isTemplate"
			:joinsIndexMap="joinsIndexMap"
			:moduleId="moduleId"
			:showColumnsAll="showColumnsAll"
			:uiScale="uiScale"
		/>
	</div>`,
	props:{
		field:          { type:Object,  required:true },
		builderLanguage:{ type:String,  required:true },
		columnIdShow:   { required:true },
		dataFields:     { type:Array,   required:true },
		entityIdMapRef: { type:Object,  required:true },
		fieldCounter:   { type:Number,  required:true },
		fieldIdShow:    { required:true },
		fieldIdShowTab: { type:String,  required:true },
		fieldMoveList:  { required:true },              
		fieldMoveIndex: { type:Number,  required:true },
		filterData:     { type:Boolean, required:true },
		filterData1n:   { type:Boolean, required:true },
		filterDataIndex:{ type:Number,  required:true },
		filterDataN1:   { type:Boolean, required:true },
		filterDataNm:   { type:Boolean, required:true },
		flexDirParent:  { type:String,  required:true },
		formId:         { type:String,  required:true },
		isTemplate:     { type:Boolean, required:true },
		joinsIndexMap:  { type:Object,  required:true },
		moduleId:       { type:String,  required:true },
		noMovement:     { type:Boolean, required:true },
		showColumnsAll: { type:Boolean, required:true },
		uiScale:        { type:Number,  required:true }
	},
	emits:[
		'column-id-show','field-counter-set','field-id-show','field-move',
		'field-move-store','field-property-set','field-remove'
	],
	data() {
		return {
			tabIndex:0 // which tab index to show (tab fields)
		};
	},
	computed:{
		columnBatchIndexTitle:(s) => {
			if(s.isGantt) return [s.capApp.ganttBatch];
			if(s.isKanban) {
				const joinsIndexMap = s.getJoinsIndexMap(s.field.query.joins);
				const getCaption = function(relationIndex) {
					const j = joinsIndexMap[relationIndex];
					return `${relationIndex} ${s.relationIdMap[j.relationId].name}`;
				};
				
				let out = [];
				if(s.field.relationIndexAxisX !== null)
					out.push(s.capApp.kanban.columnBatchX.replace('{REL}',getCaption(s.field.relationIndexAxisX)));
				if(s.field.relationIndexAxisY !== null)
					out.push(s.capApp.kanban.columnBatchY.replace('{REL}',getCaption(s.field.relationIndexAxisY)));
				
				return out;
			}
			return [];
		},
		cssClass:(s) => {
			return {
				container:s.isContainer,
				isTemplate:s.isTemplate,
				notData:!s.isData,
				selected:s.isSelected,
				tabs:s.isTabs
			};
		},
		cssClassChildren:(s) => {
			if(s.isTemplate || !s.isContainer)
				return [];
			
			// default classed
			let out = [];
			if(s.field.fields.length === 0) out.push('empty');
			
			// draggable does not support styling the main element
			// use custom classes as fallback
			if(s.field.direction === 'column') out.push('column');
			if(s.field.wrap)                   out.push('wrap');
			
			out.push(`style-justify-content-${s.field.justifyContent}`);
			out.push(`style-align-content-${s.field.alignContent}`);
			out.push(`style-align-items-${s.field.alignItems}`);
			return out;
		},
		cssStyleParent:(s) => {
			if(typeof s.field.basis === 'undefined')
				return;
			
			let basis = s.field.basis;
			if(basis !== 0)
				basis = Math.floor(basis * s.uiScale / 100);
			
			let out = [`flex:${s.field.grow} ${s.field.shrink} ${s.getFlexBasis(basis)}`];
			if(basis !== 0) {
				let dirMax = s.flexDirParent === 'row' ? 'max-width' : 'max-height';
				let dirMin = s.flexDirParent === 'row' ? 'min-width' : 'min-height';
				out.push(`${dirMax}:${basis*s.field.perMax/100}px`);
				out.push(`${dirMin}:${basis*s.field.perMin/100}px`);
			}
			return out.join(';');
		},
		show:(s) => {
			// filter only data fields
			if(!s.filterData || !s.isData) 
				return true;
			
			// filter by selected index (if set)
			if(s.filterDataIndex !== -1 && s.field.index !== s.filterDataIndex)
				return false;
			
			// filter by relationship type (show non-rel fields)
			if(!s.isRelationship)  return true;
			if(!s.field.outsideIn) return s.filterDataN1; 
			if(s.filterData1n && s.field.attributeIdNm === null) return true;
			if(s.filterDataNm && s.field.attributeIdNm !== null) return true;
			return false;
		},
		title:(s) => {
			switch(s.field.content) {
				case 'button':    return 'Button';    break;
				case 'chart':     return 'Chart';     break;
				case 'container': return 'Container'; break;
				case 'header':    return 'Label';     break;
				case 'tabs':      return 'Tabs';      break;
				case 'calendar':  return s.field.gantt ? 'Gantt' : 'Calendar'; break;
				case 'data':      return s.getItemTitle(s.field.attributeId,s.field.index,s.field.outsideIn,s.field.attributeIdNm); break;
				case 'kanban':    return s.field.query.relationId === null ? 'Kanban' : `Kanban: ${s.relationIdMap[s.field.query.relationId].name}`; break;
				case 'list':      return s.field.query.relationId === null ? 'List' : `List: ${s.relationIdMap[s.field.query.relationId].name}`; break;
			}
			return '';
		},
		warnings:(s) => {
			let out = [];
			if(s.hasQuery) {
				if(s.field.query.relationId === null) out.push(s.capApp.warning.queryRelationNotSet);
				if(s.field.columns.length   === 0)    out.push(s.capApp.warning.queryColumnsNotSet);
				
				for(let c of s.field.columns) {
					if(c.subQuery && c.attributeId === null) {
						out.push(s.capApp.warning.columnNoSubQueryAttribute);
						break;
					}
				}
			}
			if(s.isCalendar) {
				if(s.field.attributeIdDate0 === null || s.field.attributeIdDate1 === null)
					out.push(s.capApp.warning.calendarNoDateFromTo);
			}
			return out;
		},
		
		// simple
		hasQuery:      (s) => s.getFieldHasQuery(s.field),
		isButton:      (s) => s.field.content === 'button',
		isCalendar:    (s) => s.field.content === 'calendar',
		isContainer:   (s) => s.field.content === 'container',
		isData:        (s) => s.field.content === 'data',
		isGantt:       (s) => s.isCalendar && s.field.gantt,
		isHeader:      (s) => s.field.content === 'header',
		isKanban:      (s) => s.field.content === 'kanban',
		isList:        (s) => s.field.content === 'list',
		isTabs:        (s) => s.field.content === 'tabs',
		isSelected:    (s) => s.field.id      === s.fieldIdShow,
		isRelationship:(s) => !s.isData ? false : s.isAttributeRelationship(s.attribute.content),
		parentChildren:(s) => s.isContainer ? s.field.fields : (s.isTabs ? s.field.tabs[s.tabIndex].fields : []),
		moveActive:    (s) => s.fieldMoveList !== null,
		reference:     (s) => s.isTemplate ? '' : 'F' + s.entityIdMapRef.field[s.field.id],
		showColumns:   (s) => !s.isTemplate && s.hasQuery && ((s.fieldIdShow === s.field.id && s.fieldIdShowTab === 'content') || s.showColumnsAll),
		tabIndexShown: (s) => s.isTabs && s.field.tabs.length > s.tabIndex ? s.tabIndex : 0,
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		attribute:     (s) => !s.isData ? false : s.attributeIdMap[s.field.attributeId],
		capApp:        (s) => s.$store.getters.captions.builder.form,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	beforeCreate() {
		// import at runtime due to circular dependencies
		this.$options.components.MyBuilderFields = MyBuilderFields;
	},
	methods:{
		// externals
		getFieldHasQuery,
		getFieldIcon,
		getFlexBasis,
		getItemTitle,
		getJoinsIndexMap,
		getQueryExpressions,
		getQueryFiltersProcessed,
		getRelationsJoined,
		isAttributeRelationship,
		
		// actions
		openSettings() {
			this.$emit('field-id-show',this.field.id,'properties');
		},
		showWarnings() {
			this.$store.commit('dialog',{
				captionBody:`<ul><li>${this.warnings.join('</li><li>')}</li></ul>`,
				captionTop:this.capGen.warnings,
				image:'warning.png'
			});
		},
		toggleBool(oldBool) {
			return !oldBool;
		},
		toggleDir(oldDir) {
			return oldDir === 'row' ? 'column' : 'row';
		},
		toggleSize(oldVal,change,startSize) {
			if(oldVal+change < 0) return 0;
			if(oldVal === 0)      return startSize;
			
			return oldVal+change;
		},
		
		// backend calls
		getSqlPreview() {
			ws.send('dataSql','get',{
				relationId:this.field.query.relationId,
				joins:this.getRelationsJoined(this.field.query.joins),
				expressions:this.getQueryExpressions(this.field.columns),
				filters:this.getQueryFiltersProcessed(this.field.query.filters,
					this.getJoinsIndexMap(this.field.query.joins)),
				orders:this.field.query.orders,
				limit:this.field.query.fixedLimit !== 0 ? this.field.query.fixedLimit : 0
			},true).then(
				res => {
					this.$store.commit('dialog',{
						captionTop:this.capApp.sql,
						captionBody:res.payload,
						image:'database.png',
						textDisplay:'textarea',
						width:800
					});
				},
				this.$root.genericError
			);
		}
	}
};