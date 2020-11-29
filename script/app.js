const DEFAULT_PALETTES = [
  { id: 1, label: 'Basic Text, Selected Entry', value: 0xFF7F, hex: '#FFFFFF', valAddr: 0x6A64, palAddrs: [0x6A50] },
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
    this.loadFromStorage();
    this.buildPatch();
  },
  watch: {
    freeSlot: function(val) {
      (this.extras.find(e => e.id.toString() === val) || {}).overrideId = null;
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
          palette.overrideHex = extra.hex;
        } else if (this.freeSlot === extra.id.toString()) {
          const palette = palettes.find(p => p.id === 5);
          palette.pal = extra.pal;
          palette.palAddrs = palette.palAddrs.slice(0, 1);
        }
      });
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

Vue.component('live-preview', {
  props: ['palettes', 'show-menu'],
  computed: {
    basicText: function() { return this.getStandardColor(1); },
    unselectedROM: function() { return this.getStandardColor(2); },
    folderMenuItem: function() { return this.getStandardColor(3); },
    menuHeaderBG: function() { return this.getStandardColor(4); },
    headerFooterMenuBG: function() { return this.getStandardColor(5); },
    backgroundColor: function() { return this.getOverrideColor(0); },
    menuHeaderText: function() { return this.getOverrideColor(0x7E); },
  },
  watch: {
    palettes: function() {
      this.renderCanvas();
    }
  },
  mounted: function() {
    this.renderCanvas();
  },
  methods: {
    getStandardColor: function(id) {
      const palette = this.palettes.find(p => p.id === id);
      return palette.overrideHex ? '#000000' : palette.hex;
    },
    getOverrideColor: function(pal) {
      const palette = this.palettes.find(p => p.pal === pal) || {};
      return palette.overrideHex || palette.hex || '#000000';
    },
    renderCanvas: function() {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext('2d');
      ctx.font = "bold 14px monospace";

      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, 360, 240);
      ctx.fillStyle = this.headerFooterMenuBG;
      ctx.fillRect(0, 0, 360, 12);
      ctx.fillRect(0, 240-24, 360, 24);

      ctx.fillStyle = this.basicText;
      ctx.fillText("Basic Text", 1, 10);

      if (this.showMenu) {
        ctx.fillStyle = this.folderMenuItem;
        ctx.fillText("Selected Folder", 1, 240-14);
      } else {
        ctx.fillText("Selected ROM", 1, 240-14);
      }

      for (let i = 0; i < 15; i++) {
        const y = i * 12 + 32;
        if (i === 0) {
          if (this.showMenu) {
            ctx.fillStyle = this.basicText;
            ctx.fillText("Selected Folder", 1, y);
          } else {
            ctx.fillStyle = this.folderMenuItem;
            ctx.fillText("Unselected Folder", 1, y);
          }
        } else if (i === 6 && !this.showMenu) {
          ctx.fillStyle = this.basicText;
          ctx.fillText("Selected ROM", 1, y);
        } else {
          ctx.fillStyle = this.unselectedROM;
          ctx.fillText("Unselected ROM", 1, y);
        }
      }

      if (this.showMenu) {
        ctx.fillStyle = this.headerFooterMenuBG;
        ctx.fillRect(68, 22, 222, 168);
        ctx.fillStyle = this.menuHeaderBG;
        ctx.fillRect(68, 22, 222, 12);
        ctx.fillStyle = this.menuHeaderText;
        ctx.fillText("Main Menu", 136, 32);

        ctx.fillStyle = this.basicText;
        ctx.fillText("Options", 144, 32+12*2);
        ctx.fillStyle = this.folderMenuItem;
        ctx.fillText("Recently Played", 111, 32+12*4);
        ctx.fillText("Start Random Game", 103, 32+12*6);
        ctx.fillText("Device Info", 128, 32+12*8);
        ctx.fillText("Diagnostics", 128, 32+12*10);
        ctx.fillText("About", 154, 32+12*12);
      }
    },
  },
  template: `
    <canvas width='360' height='240' ref='canvas'></canvas>
  `
});
