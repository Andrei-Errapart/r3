import MyStoreLocal            from './storeLocal.js';
import MyStoreSchema           from './storeSchema.js';
import { colorAdjustBgHeader } from '../comps/shared/generic.js';
export {MyStore as default};

const MyStore = Vuex.createStore({
	modules:{
		local:MyStoreLocal,
		schema:MyStoreSchema
	},
	state:{
		access:{},                     // access permissions for each entity (attribute, collection, menu, relation), key: entity ID
		builderMode:false,             // builder mode active
		busyCounter:0,                 // counter of calls making the app busy (WS requests, uploads, etc.)
		captions:{},                   // all application captions in the user interface language
		clusterNodeName:'',            // name of the cluster node that session is connected to
		collectionIdMap:{},            // map of all collection values, key = collection ID
		config:{},                     // configuration values (admin only)
		constants:{                    // constant variables, codes/messages/IDs
			kdfIterations:10000,       // number of iterations for PBKDF2 key derivation function
			keyLength:64,              // length of new symmetric keys for data encryption
			scrollFormId:'form-scroll' // ID of form page element (to recover scroll position during routing)
		},
		dialogCaptionTop:'',
		dialogCaptionBody:'',
		dialogButtons:[],
		dialogImage:null,
		dialogStyles:'',
		dialogTextDisplay:'', // display option (html, textarea, richtext)
		feedback:false,       // feedback function is enabled
		filesCopy:{           // meta data for file copy (filled on copy, emptied on paste)
			attributeId:null,
			fileIds:[]
		},
		isAdmin:false,        // user is admin
		isAtDialog:false,     // app shows generic dialog
		isAtFeedback:false,   // app shows feedback dialog
		isAtMenu:false,       // user navigated to menu (only relevant if isMobile)
		isMobile:false,       // app runs on small screen (probably mobile)
		isNoAuth:false,       // user logged in without authentication
		license:{},           // license info (admin only)
		licenseValid:false,   // license is valid (set and within validity period)
		loginEncryption:false,// user login E2E encryption is used
		loginHasClient:false, // login has an associated client (to allow for local file handling)
		loginId:-1,           // user login ID
		loginName:'',         // user login name
		loginPrivateKey:null, // user login private key for decryption (non-exportable key)
		loginPrivateKeyEnc:null,       // user login private key PEM, encrypted with login key
		loginPrivateKeyEncBackup:null, // user login private key PEM, encrypted with backup code
		loginPublicKey:null,  // user login public key for encryption (exportable key)
		logo:'',
		moduleEntries:[],     // module entries for header/home page
		moduleLanguage:'',    // module language (either equal to user language or module fallback)
		moduleIdLast:null,    // module ID of last active module
		pageTitle:'',         // web page title, set by app/form depending on navigation
		pageTitleFull:'',     // web page title + instance name
		popUpFormGlobal:null, // configuration of global pop-up form
		productionMode:false, // system in production mode, false if maintenance
		pwaDomainMap:{},      // map of modules per PWA sub domain, key: sub domain, value: module ID
		routingGuards:[],     // functions to call before routing, abort if any returns falls
		searchDictionaries:[],// dictionaries used for full text search for this login, ['english', 'german', ...]
		settings:{},          // setting values for logged in user, key: settings name
		sessionValueStore:{}, // user session key-value store for frontend functions, { moduleId1:{ key1:value1, key2:value2 }, moduleId2:{ ... } }
		system:{}             // system details (admin only)
	},
	mutations:{
		config:(state,payload) => {
			state.builderMode = payload.builderMode === '1';
			state.config      = payload;
		},
		dialog:(state,payload) => {
			state.dialogCaptionTop = typeof payload.captionTop !== 'undefined' ?
				payload.captionTop : '';
			
			state.dialogCaptionBody = typeof payload.captionBody !== 'undefined' ?
				payload.captionBody : '';
			
			state.dialogImage = typeof payload.image !== 'undefined' ?
				payload.image : null;
			
			state.dialogTextDisplay = typeof payload.textDisplay !== 'undefined' ?
				payload.textDisplay : 'html';
			
			let styles = '';
			
			if(typeof payload.width !== 'undefined')
				styles += `max-width:${payload.width}px;`;
			
			if(typeof payload.buttons === 'undefined')
				payload.buttons = [{
					caption:state.captions.generic.button.close,
					cancel:true,
					image:'cancel.png',
					keyEscape:true
				}];
			
			state.dialogStyles  = styles;
			state.dialogButtons = payload.buttons;
			state.isAtDialog    = true;
		},
		filesCopyReset:(state,payload) => {
			state.filesCopy = {
				attributeId:null,
				fileIds:[]
			};
		},
		license:(state,payload) => {
			state.license = payload;
			
			if(typeof payload.validUntil === 'undefined')
				return state.licenseValid = false;
			
			state.licenseValid = payload.validUntil > Math.floor(new Date().getTime() / 1000);
		},
		pageTitle:(state,payload) => {
			state.pageTitle = payload;
			let names = [payload];
			
			if(MyStoreLocal.state.appNameShort !== '')
				names.push(MyStoreLocal.state.appNameShort);
			
			state.pageTitleFull = names.join(' - ');
			
			// update document title whenever page title changes
			document.title = state.pageTitleFull;
		},
		pageTitleRefresh:(state,payload) => {
			MyStore.commit('pageTitle',state.pageTitle);
		},
		sessionValueStore:(state,payload) => {
			if(typeof state.sessionValueStore[payload.moduleId] === 'undefined')
				state.sessionValueStore[payload.moduleId] = {};
			
			state.sessionValueStore[payload.moduleId][payload.key] = payload.value;
		},
		
		routingGuardAdd:(state,payload) => {
			state.routingGuards.push(payload);
		},
		routingGuardDel:(state,payload) => {
			for(let i = 0, j = state.routingGuards.length; i < j; i++) {
				if(state.routingGuards[i] === payload)
					return state.routingGuards.splice(i,1);
			}
		},
		
		// collections
		collection:      (state,payload) => state.collectionIdMap[payload.id] = payload.rows,
		collectionsClear:(state,payload) => state.collectionIdMap = {},
		
		// counters
		busyAdd:   (state,payload) => state.busyCounter++,
		busyRemove:(state,payload) => state.busyCounter--,
		busyReset: (state,payload) => state.busyCounter=0,
		
		// simple
		access:         (state,payload) => state.access          = payload,
		captions:       (state,payload) => state.captions        = payload,
		clusterNodeName:(state,payload) => state.clusterNodeName = payload,
		feedback:       (state,payload) => state.feedback        = payload,
		filesCopy:      (state,payload) => state.filesCopy       = payload,
		isAdmin:        (state,payload) => state.isAdmin         = payload,
		isAtDialog:     (state,payload) => state.isAtDialog      = payload,
		isAtFeedback:   (state,payload) => state.isAtFeedback    = payload,
		isAtMenu:       (state,payload) => state.isAtMenu        = payload,
		isNoAuth:       (state,payload) => state.isNoAuth        = payload,
		isMobile:       (state,payload) => state.isMobile        = payload,
		loginEncryption:(state,payload) => state.loginEncryption = payload,
		loginHasClient: (state,payload) => state.loginHasClient  = payload,
		loginId:        (state,payload) => state.loginId         = payload,
		loginName:      (state,payload) => state.loginName       = payload,
		loginPrivateKey:(state,payload) => state.loginPrivateKey = payload,
		loginPrivateKeyEnc:      (state,payload) => state.loginPrivateKeyEnc       = payload,
		loginPrivateKeyEncBackup:(state,payload) => state.loginPrivateKeyEncBackup = payload,
		loginPublicKey: (state,payload) => state.loginPublicKey  = payload,
		moduleEntries:  (state,payload) => state.moduleEntries   = payload,
		moduleLanguage: (state,payload) => state.moduleLanguage  = payload,
		moduleIdLast:   (state,payload) => state.moduleIdLast    = payload,
		popUpFormGlobal:(state,payload) => state.popUpFormGlobal = payload,
		productionMode: (state,payload) => state.productionMode  = payload,
		pwaDomainMap:   (state,payload) => state.pwaDomainMap  = payload,
		searchDictionaries:(state,payload) => state.searchDictionaries = payload,
		settings:       (state,payload) => state.settings        = payload,
		system:         (state,payload) => state.system          = payload
	},
	getters:{
		licenseDays:(state) => {
			if(!state.licenseValid)
				return 0;
			
			let seconds = state.license.validUntil - (new Date().getTime() / 1000);
			return Math.round(seconds / 60 / 60 / 24);
		},
		patternStyle:(state) => {
			return state.settings.pattern !== null
				? `background-image:url('images/pattern_${state.settings.pattern}.webp');background-repeat:repeat-x`
				: '';
		},
		pwaModuleId:(state) => {
			if(!MyStoreLocal.state.activated)
				return null;
			
			let subDomain = window.location.host.split('.')[0];
			return typeof state.pwaDomainMap[subDomain] !== 'undefined'
				? state.pwaDomainMap[subDomain] : null;
		},
		
		// simple
		access:           (state) => state.access,
		blockInput:       (state) => state.busyCounter > 0,
		builderEnabled:   (state) => state.builderMode && !state.productionMode,
		busyCounter:      (state) => state.busyCounter,
		captions:         (state) => state.captions,
		clusterNodeName:  (state) => state.clusterNodeName,
		collectionIdMap:  (state) => state.collectionIdMap,
		config:           (state) => state.config,
		constants:        (state) => state.constants,
		dialogCaptionTop: (state) => state.dialogCaptionTop,
		dialogCaptionBody:(state) => state.dialogCaptionBody,
		dialogButtons:    (state) => state.dialogButtons,
		dialogImage:      (state) => state.dialogImage,
		dialogStyles:     (state) => state.dialogStyles,
		dialogTextDisplay:(state) => state.dialogTextDisplay,
		feedback:         (state) => state.feedback,
		filesCopy:        (state) => state.filesCopy,
		isAdmin:          (state) => state.isAdmin,
		isAtDialog:       (state) => state.isAtDialog,
		isAtFeedback:     (state) => state.isAtFeedback,
		isAtMenu:         (state) => state.isAtMenu,
		isMobile:         (state) => state.isMobile,
		isNoAuth:         (state) => state.isNoAuth,
		license:          (state) => state.license,
		licenseValid:     (state) => state.licenseValid,
		loginEncryption:  (state) => state.loginEncryption,
		loginHasClient:   (state) => state.loginHasClient,
		loginId:          (state) => state.loginId,
		loginName:        (state) => state.loginName,
		loginPrivateKey:  (state) => state.loginPrivateKey,
		loginPrivateKeyEnc:      (state) => state.loginPrivateKeyEnc,
		loginPrivateKeyEncBackup:(state) => state.loginPrivateKeyEncBackup,
		loginPublicKey:   (state) => state.loginPublicKey,
		moduleEntries:    (state) => state.moduleEntries,
		moduleLanguage:   (state) => state.moduleLanguage,
		moduleIdLast:     (state) => state.moduleIdLast,
		pageTitleFull:    (state) => state.pageTitleFull,
		popUpFormGlobal:  (state) => state.popUpFormGlobal,
		productionMode:   (state) => state.productionMode,
		pwaDomainMap:     (state) => state.pwaDomainMap,
		routingGuards:    (state) => state.routingGuards,
		searchDictionaries:(state) => state.searchDictionaries,
		sessionValueStore:(state) => state.sessionValueStore,
		settings:         (state) => state.settings,
		system:           (state) => state.system
	}
});