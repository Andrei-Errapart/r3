import {getDependentModules} from '../shared/builder.js';
import {srcBase64}           from '../shared/image.js';
export {MyBuilderIconInput as default};

let MyBuilderIconInput = {
	name:'my-builder-icon-input',
	template:`<div class="builder-icon-input">
		<div class="iconLine input-custom" :tabindex="readonly ? -1 : 0"
			@click="click"
			:class="{ clickable:!readonly, disabled:readonly }"
		>
			<img class="builder-icon"
				v-if="iconSelected"
				:src="srcBase64(iconSelected.file)"
			/>
			<img class="builder-icon not-set" src="images/noPic.png"
				v-if="!iconSelected"
			/>
		</div>
		
		<div class="app-sub-window" v-if="showInput && iconIdMap !== null" @click.self="close">
			<div class="build-icon-input-window shade">
				<div class="contentBox">
					<div class="top lower">
						<div class="area">
							<img class="icon"
								v-if="iconSelected"
								:src="srcBase64(iconSelected.file)"
							/>
							<img class="icon" src="images/noPic.png"
								v-if="!iconSelected"
							/>
						</div>
						<div class="area default-inputs">
							<input v-model="filter" :placeholder="capGen.button.filter" />
						</div>
						<div class="area">
							<my-button image="cancel.png"
								@trigger="close"
								:cancel="true"
							/>
						</div>
					</div>
					<div class="content">
						<div class="module" :class="{ first:i === 0 }"
							v-for="(mod,i) in getDependentModules(module,modules).filter(v => v.icons.length !== 0)"
						>
							<span>{{ mod.name }}</span>
							
							<img class="builder-icon clickable"
								v-for="icon in mod.icons.filter(v => filter === '' || v.name.toLowerCase().includes(filter.toLowerCase()))"
								@click="select(icon.id)"
								:class="{ active:iconIdSelected === icon.id }"
								:src="srcBase64(icon.file)"
								:title="icon.name"
							/>
						</div>
						<div class="actions">
							<my-button image="ok.png"
								@trigger="close"
								:caption="capGen.button.ok"
							/>
							<my-button image="remove.png"
								@trigger="select(null)"
								:active="iconSelected !== false"
								:caption="capGen.button.clear"
								:cancel="true"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>`,
	props:{
		module:        { type:Object,  required:true},
		iconIdSelected:{ required:true },
		readonly:      { type:Boolean, required:false, default:false }
	},
	emits:['input'],
	data:function() {
		return {
			filter:'',
			showInput:false
		};
	},
	computed:{
		iconSelected:(s) => s.iconIdSelected === null ? false : s.iconIdMap[s.iconIdSelected],
		
		// stores
		modules:  (s) => s.$store.getters['schema/modules'],
		iconIdMap:(s) => s.$store.getters['schema/iconIdMap'],
		capGen:   (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDependentModules,
		srcBase64,
		
		// actions
		click() {
			if(!this.readonly)
				this.showInput = !this.showInput;
		},
		close() {
			this.showInput = false;
		},
		select(iconId) {
			this.$emit('input',iconId);
		}
	}
};
