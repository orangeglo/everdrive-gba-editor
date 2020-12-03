/*
  - Shareable urls
  - Preview image with shareable url is the theme preview
  - gallery?
  - more control over saving? need to prevent shared theme from overriding
*/

const DEFAULT_PALETTES = [
  { id: 1, label: 'Basic Text, Selected Entry', value: 0xFF7F, hex: '#FFFFFF', valAddr: 0x6A64, palAddrs: [0x6A60] },
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

const deepClone = (arr) => {
  return arr.map(obj => Object.assign({}, obj));
}

Vue.component('live-preview', {
  props: ['palettes', 'show-menu', 'fonts-loaded'],
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
    palettes: function() { this.renderCanvas(); },
    fontsLoaded: function() { this.renderCanvas(); }
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
      ctx.font = "21px ibm";

      const write = (text, x, y) => {
        if (this.fontsLoaded) { ctx.fillText(text, x*2, (y+0.5)*2); }
      }

      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, 720, 480);
      ctx.fillStyle = this.headerFooterMenuBG;
      ctx.fillRect(0, 0, 720, 24);
      ctx.fillRect(0, (240-24)*2, 720, 48);

      ctx.fillStyle = this.basicText;
      write("Basic Text", 2, 10);

      if (this.showMenu) {
        ctx.fillStyle = this.folderMenuItem;
        write("Selected Folder", 2, 240-13);
      } else {
        write("Selected ROM", 2, 240-14);
      }

      for (let i = 0; i < 15; i++) {
        const y = i * 12 + 33;
        if (i === 0) {
          if (this.showMenu) {
            ctx.fillStyle = this.basicText;
            write("Selected Folder", 2, y);
          } else {
            ctx.fillStyle = this.folderMenuItem;
            write("Unselected Folder", 2, y);
          }
        } else if (i === 6 && !this.showMenu) {
          ctx.fillStyle = this.basicText;
          write("Selected ROM", 2, y);
        } else {
          ctx.fillStyle = this.unselectedROM;
          write("Unselected ROM", 2, y);
        }
      }

      if (this.showMenu) {
        ctx.fillStyle = this.headerFooterMenuBG;
        ctx.fillRect(68*2, 23*2, 222*2, 168*2);
        ctx.fillStyle = this.menuHeaderBG;
        ctx.fillRect(68*2, 23*2, 222*2, 12*2);
        ctx.fillStyle = this.menuHeaderText;
        write("Main Menu", 126, 33);

        ctx.fillStyle = this.basicText;
        write("Options", 138, 32+12*2);
        ctx.fillStyle = this.folderMenuItem;
        write("Recently Played", 92, 32+12*4);
        write("Start Random Game", 80, 32+12*6);
        write("Device Info", 115, 32+12*8);
        write("Diagnostics", 115, 32+12*10);
        write("About", 151, 32+12*12);
      }
    },
  },
  template: `
    <canvas width='720' height='480' ref='canvas'></canvas>
  `
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

const app = new Vue({
  el: '#app',
  data: {
    palettes: deepClone(DEFAULT_PALETTES),
    extras: deepClone(DEFAULT_EXTRAS),
    patchData: null,
    buildPatchTimeoutHandle: null,
    freeSlot: '',
    fontsLoaded: false,
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
      const palettes = deepClone(this.palettes);
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
    reset: function() {
      const sure = window.confirm('Are you sure you want to reset to the default colors?');
      if (sure) {
        this.palettes = deepClone(DEFAULT_PALETTES);
        this.extras = deepClone(DEFAULT_EXTRAS);
        this.freeSlot = '';
        this.buildPatch();
      }
    },
    triggerIpsFileLabel: function() { this.$refs.ipsFileLabel.click(); },
    uploadIPS: function(e) {
      const fileReader = new FileReader()
      fileReader.onload = () => {
        this.parseIPS(fileReader.result);
      }
      fileReader.readAsArrayBuffer(e.target.files[0]);
      e.target.value = '';
    },
    parseIPS(ipsArrayBuffer) {
      console.log(ipsArrayBuffer.slice(5, ipsArrayBuffer.byteLength - 3));
      const buffer = new Uint8Array(ipsArrayBuffer).slice(5, ipsArrayBuffer.byteLength - 3);
      const data = [];

      const map = {};
      map['6A64'] = val => this.palette.find(p => p.id === 1)
      // convert each address into some state change
      // need to bring in conversion from bgr to hex here

      let state = 'offset';
      let index = 0;
      let temp = {};
      while (index < buffer.length) {
        if (state === 'offset') {
          const o = buffer.slice(index, index + 3);
          temp.offset = parseInt(`${o[0].toString(16)}${o[1].toString(16)}${o[2].toString(16)}`, 16);
          temp.offsetHex = temp.offset.toString(16);
          index += 4;
          state = 'length';
        } else if (state === 'length') {
          temp.length = buffer[index];
          index++;
          state = 'value';
        } else { // state === 'value'
          const v = buffer.slice(index, index + temp.length);
          let stringValue = '';
          v.forEach(val => stringValue += val.toString(16));
          temp.value = parseInt(stringValue, 16);
          temp.valueHex = temp.value.toString(16);
          index += temp.length;
          data.push(temp);
          temp = {};
          state = 'offset';
        }
      }

      console.log(data);
    },
  }
});

document.fonts.ready.then(function() { app.fontsLoaded = true;});
