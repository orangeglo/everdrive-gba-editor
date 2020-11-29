const DEFAULT_PALETTES = [
  { id: 1, label: 'Basic Text, Highlighted Entry', value: 0xFF7F, hex: '#FFFFFF', valAddr: 0x6A64, palAddrs: [0x6A50] },
  { id: 2, label: 'Unselected ROM', value: 0xF75E, hex: '#BDBDBD', valAddr: 0x6A50, palAddrs: [0x6A54] },
  { id: 3, label: 'Unselected Folder, Menu Item', value: 0xBD27, hex: '#EFEF4A', valAddr: 0x6A5C, palAddrs: [0x6A58] },
  { id: 4, label: 'Menu Header BG', value: 0x947E, hex: '#A5A5FF', valAddr: 0x6A80, palAddrs: [0x6A7C] },
  { id: 5, label: 'ROM List Header/Footer BG, Menu BG', value: 0x3146, hex: '#8C8C8C', valAddr: 0x6A70, palAddrs: [0x6A6C, 0x6A74, 0x6A78] },
];
const DEFAULT_EXTRAS = [
  { id: 6, label: 'Background', value: 0x0000, hex: '#000000', overrideId: null, pal: 0 },
  { id: 7, label: 'Menu Header Text', value: 0x0000, hex: '#000000', overrideId: null, pal: 0x7E }
];
const IPS_HEADER = [0x50, 0x41, 0x54, 0x43, 0x48];
const IPS_EOF = [0x45, 0x4F, 0x46];

Vue.component('palette-entry', {
  props: ['palette', 'extra', 'free-slot-color', 'disabled'],
  template: `
    <div class='palette'>
      <label :for="'palette-' + palette.id" :class="{disabled: disabled}">
        {{ palette.id }}. {{ palette.label }}
      </label>
      <div class='controls'>
        <select
          v-if='extra'
          @change="e => {
            $emit('override-changed', { value: e.target.value, id: palette.id });
          }"
          :class="{disabled: disabled}"
          :value='palette.overrideId'
        >
          <option value=''>Inactive</option>
          <option value='1'>Override #1</option>
          <option value='2'>Override #2</option>
          <option value='3'>Override #3</option>
          <option value='4'>Override #4</option>
          <option value='5'>Override #5</option>
        </select>
        <input
          type='text'
          :value="palette.hex"
          @input="e => {
            $emit('color-changed', { value: e.target.value, id: palette.id });
          }"
          maxlength='7'
          pattern="#[0-9A-Fa-f]{6}"
          class='color-input'
          :class="{disabled: disabled}"
        />
        <input
          v-if="!disabled"
          :id="'palette-' + palette.id"
          type='color'
          :value="palette.hex"
          @input="e => {
            $emit('color-changed', { value: e.target.value, id: palette.id });
          }" 
          :class="{disabled: disabled}"
        />
        <input
          v-if="disabled && !extra"
          type='color'
          value='#000000'
          :disabled='true'
        />
        <input
          v-if="disabled && extra"
          type='color'
          :value="freeSlotColor"
          :disabled='true'
        />
      </div>
    </div>
  `
});

const app = new Vue({
  el: '#app',
  data: {
    palettes: DEFAULT_PALETTES.slice(),
    extras: DEFAULT_EXTRAS.slice(),
    patchData: null,
    buildPatchTimeoutHandle: null,
    freeSlot: '',
  },
  created() {
    // this.loadFromStorage();
    this.buildPatch();
  },
  watch: {
    freeSlot: function(val) {
      this.extras.find(e => e.id.toString() === val).overrideId = null;
      this.triggerBuildPatch();
    },
  },
  computed: {
    combinedPalettes: function() {
      const palettes = this.palettes.map(p => Object.assign({}, p));
      this.extras.forEach(extra => {
        if (extra.overrideId) {
          const palette = palettes.find(p => p.id === extra.overrideId);
          palette.pal = extra.pal;
          palette.value = extra.value;
        } else if (this.freeSlot === extra.id.toString()) {
          const palette = palettes.find(p => p.id === 5);
          palette.pal = extra.pal;
          palette.palAddrs = palette.palAddrs.slice(0, 1);
        }
      });
      console.log(palettes);
      return palettes;
    },
    downloadEnabled: function() {
      return this.combinedPalettes.every(p => p.hex.length === 7);
    },
    freeSlotDisabled: function() {
      return this.disabledPalettes.includes(5);
    },
    freeSlotColor: function() {
      return this.palettes.find(p => p.id === 5).hex;
    },
    disabledPalettes: function() {
      return ([
        this.extras.map(e => e.overrideId),
        (this.extras.find(e => e.id.toString() === this.freeSlot) || {}).id
      ].flat());
    },
  },
  methods: {
    colorChanged: function(value, id) {
      const palette = (id > 5 ? this.extras : this.palettes).find(p => p.id === id);
      palette.hex = value.toUpperCase();
      palette.value = this.hexToBGR(palette.hex);
      this.triggerBuildPatch();
    },
    overrideChanged: function(value, id) {
      const extra = this.extras.find(e => e.id === id);
      extra.overrideId = value === '' ? null : parseInt(value);
      this.extras.filter(e => e.id !== extra.id).forEach(e => {
        if (e.overrideId === extra.overrideId) {
          e.overrideId = null;
        }
      });
      if (value === '5') { this.freeSlot = ''; }
      this.triggerBuildPatch();
    },
    hexToBGR: function(hex) {
      const r = Math.floor(parseInt(hex.slice(1, 3), 16) / 8) << 0;
      const g = Math.floor(parseInt(hex.slice(3, 5), 16) / 8) << 5;
      const b = Math.floor(parseInt(hex.slice(5, 7), 16) / 8) << 10;
      const temp = (b + g + r).toString(16).padStart(4, '0');
      return parseInt(temp.slice(2, 4) + temp.slice(0, 2), 16);
    },
    triggerBuildPatch: function() {
      if (this.buildPatchTimeoutHandle) {
        clearTimeout(this.buildPatchTimeoutHandle);
      }
      this.buildPatchTimeoutHandle = setTimeout(() => {
        this.buildPatch();
      }, 100);
    },
    buildPatch: function() {
      this.saveToStorage();
      this.buildPatchTimeoutHandle = null;

      const chunks = [];
      this.combinedPalettes.forEach(palette => {
        chunks.push(0); // 3 byte offset
        chunks.push(palette.valAddr >>> 8);
        chunks.push(palette.valAddr & 0xFF);
        chunks.push(0); // 2 byte size
        chunks.push(2);
        chunks.push(palette.value >>> 8); // 2 byte value
        chunks.push(palette.value & 0xFF);

        if (typeof(palette.pal) === 'number') { // overriden
          palette.palAddrs.forEach(palAddr => {
            chunks.push(0); // 3 byte offset
            chunks.push(palAddr >>> 8);
            chunks.push(palAddr & 0xFF);
            chunks.push(0); // 2 byte size
            chunks.push(1);
            chunks.push(palette.pal); // 1 byte value
          });
        }
      });

      const bytes = new Uint8Array([IPS_HEADER, chunks.flat(), IPS_EOF].flat());
      if (this.patchData) { URL.revokeObjectURL(this.patchData) }
      this.patchData = URL.createObjectURL(new Blob([bytes]));
    },
    saveToStorage: function() {
      localStorage.setItem('palettes', JSON.stringify(this.palettes));
      localStorage.setItem('extras', JSON.stringify(this.extras));
      localStorage.setItem('freeSlot', JSON.stringify(this.freeSlot));
    },
    loadFromStorage: function() {
      const palettesJson = localStorage.getItem('palettes');
      const extrasJson = localStorage.getItem('extras');
      const freeSlotJson = localStorage.getItem('freeSlot');
      if (palettesJson) { this.palettes = JSON.parse(palettesJson); }
      if (extrasJson) { this.extras = JSON.parse(extrasJson); }
      if (freeSlotJson) { this.freeSlot = JSON.parse(freeSlotJson); }
    },
  }
});
