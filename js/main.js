"use strict";
import * as Tone from 'tone'; //todo remove

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

let audioCtx;

function init() {
  document.getElementById("start").remove();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  navigator.mediaDevices.getUserMedia({audio: true})
    .then(
      function (stream) {
        const fft = new FFTAnalyser(audioCtx,stream);
        const ac = new AutoCorrelator(audioCtx,stream);

        function analysePitch() {
          fft.perform();
          ac.perform();
          requestAnimationFrame(analysePitch);
        }

        analysePitch()
      });
}



class FixedLengthQueue{
  constructor(length){
    this.length = length;
    this.q = [];
  }

  queue(elem){
    this.q.push(elem);
    if(this.q.length > this.length){
      this.q.shift();
    }
  }

  unQueue(){
    return this.q.shift();
  }

  count(e){
    return this.q.filter(s => s === e).length;
  }

}

class PitchAnalyser{
  static hannWindow(arr){
    return arr.map((v,i) => 0.5 * v *( 1 - Math.cos(2 * Math.PI * i / arr.length)));
  }
}

class FFTAnalyser {
  constructor(audioCtx, stream) {
    this.FFT_CONTAINER_ID = "fft-container";

    this.source = audioCtx.createMediaStreamSource(stream);
    this.analyser = audioCtx.createAnalyser();
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = 0.85;
    this.analyser.fftSize = 32768;
    this.binWidth = audioCtx.sampleRate / this.analyser.frequencyBinCount;
    this.lowPassFilterNode = new BiquadFilterNode(audioCtx, {type: "lowpass", frequency: 1050}); //according to slides like trčeks lectures
    this.highPassFilterNode = new BiquadFilterNode(audioCtx, {type: "highpass", frequency: 90});
    this.source.connect(this.lowPassFilterNode);
    this.lowPassFilterNode.connect(this.highPassFilterNode);
    this.highPassFilterNode.connect(this.analyser);

    this.noteDisplay = new NoteDisplay(this.FFT_CONTAINER_ID);
  }

  perform(){
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const maxVal = Math.max(...dataArray);
    const frequency = dataArray.indexOf(maxVal) * this.binWidth / 2;
    this.noteDisplay.changeNote(frequency)
  }
}

class FilterBankAnalyser {
  constructor() {
    this.FILTERBANK_CONTAINER_ID = "filterbank-container";

    this.source = audioCtx.createMediaStreamSource(stream);
    // this.analyser = audioCtx.createAnalyser();
    // this.analyser.minDecibels = -90;
    // this.analyser.maxDecibels = -10;
    // this.analyser.smoothingTimeConstant = 0.85;
    // this.analyser.fftSize = 32768;
    this.binWidth = audioCtx.sampleRate / this.analyser.frequencyBinCount;
    this.source.connect(this.analyser);

    this.noteDisplay = new NoteDisplay(this.FILTERBANK_CONTAINER_ID);

   //  for()
   // //
  }
}

class AutoCorrelator {
  constructor(audioCtx, stream) {
    this.AC_CONTAINER_ID = "ac-container";
    this.K = 0.95;

    this.source = audioCtx.createMediaStreamSource(stream);

    this.analyser = audioCtx.createAnalyser();
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = 0.85;
    this.analyser.fftSize = 2048;
    this.binWidth = audioCtx.sampleRate / this.analyser.frequencyBinCount;

    this.source.connect(this.analyser);

    this.display = new NoteDisplay(this.AC_CONTAINER_ID);
    this.canvas = new Canvas();
  }

  perform() {
    const arrayLen = this.analyser.frequencyBinCount;
    const W = arrayLen;
    const t = 0;

    let dataArray = new Float32Array(arrayLen);
    this.analyser.getFloatTimeDomainData(dataArray);
    //dataArray = PitchAnalyser.hannWindow(dataArray)

    let r = new Float32Array(W).fill(0);
    let m = new Float32Array(W).fill(0);
    let n = new Float32Array(W).fill(0);

    for(let tau = 0; tau < W; tau++){
      for(let j = t; j < t + W - tau; j++){
        r[tau] += dataArray[j] * dataArray[j+tau];
        m[tau] += Math.pow(dataArray[j],2) + Math.pow(dataArray[j+tau],2);
      }
      n[tau] = (2 * r[tau]) / m[tau];
    }

    const idx = this.getBestValueFromAC(n);
    const f = audioCtx.sampleRate/idx;
    // console.log(f, NoteDisplay.frequencyToMidi(f));
    this.display.changeNote(f);
    this.canvas.plotCorrelationAndMax(n,idx);
  }

  getBestValueFromAC(n){ //n: array, k threshold constant
    let maxIndexes = [];
    let absoluteMax = 0
    let currentMax = 0;
    let absoluteMaxIndex = 1;
    let currentMaxIndex = 1;

    let i;
    for(i=0; n[i]>0; i++);
    for(;i < n.length; i++){ //we ignore the first value
      if(n[i] < 0) continue;

      if(n[i-1] < 0){
        if (currentMax > 0){
          maxIndexes.push(currentMaxIndex)
        }
        currentMax = 0;
        currentMaxIndex = 1;
      }

      if(n[i] > currentMax){
        currentMax = n[i];
        currentMaxIndex = i;
        if(n[i] > absoluteMax){
          absoluteMax = n[i];
          absoluteMaxIndex = i;
        }
      }
    }
    // console.log(absoluteMax,absoluteMaxIndex)
    // console.log(maxIndexes)

    const threshold = this.K * absoluteMax;

    for(let j = 0; j < maxIndexes.length; j++){
      if(n[maxIndexes[j]] > threshold){
        return maxIndexes[j];
      }
    }

    return -1;
  }
}

class NoteDisplay{
  constructor(containerId){
    this.WHITE_KEY_CLASS_NAME = "white-key";
    this.BLACK_KEY_CLASS_NAME = "black-key";
    this.ACTIVE_KEY_CLASS_NAME = "active";
    this.PIANO_CLASS = "piano";
    this.OCTAVE_CLASS = "octave";
    this.NOTE_CONTAINER_CLASS = "note-container";
    this.STARTNOTE = "F";
    this.STARTOCTAVE = 2;
    this.KEYBOARD_LENGTH = 45

    this.last5Values = new FixedLengthQueue(5);

    this.containerId = containerId;
    this.noteContainer = document.querySelector("#" + containerId + " > ." + this.NOTE_CONTAINER_CLASS);
    this.currentNote = this.STARTNOTE + this.STARTOCTAVE;
    console.log(this.currentNote)

    this.buildPiano(this.PIANO_CLASS,this.KEYBOARD_LENGTH, this.STARTNOTE, this.STARTOCTAVE);
    this.buildOctave(this.OCTAVE_CLASS, 13, "C");
    NoteDisplay.log12sqrt2 = Math.log(12 * Math.SQRT2);
  }


  buildPiano(class_name, numberOfKeys, startNote, startOctave, numbers = true) {
    let noteIndex = NOTES.indexOf(startNote);
    const selector = "#" + this.containerId + " > ." + class_name;

    const container = document.querySelector(selector);
    for (let i = noteIndex; i < numberOfKeys + noteIndex; i++) {
      let element = document.createElement("span");
      element.id = this.containerId + NoteDisplay.convertNoteStringToId(NOTES[i % 12] + (numbers ? startOctave : ""));
      if (NoteDisplay.isBlackKey(NOTES[i % 12])) {
        element.className = this.BLACK_KEY_CLASS_NAME;
        element.innerHTML = "#";
      } else {
        element.className = this.WHITE_KEY_CLASS_NAME;
        element.innerHTML = "" + NOTES[i % 12] + (numbers ? startOctave : "");
      }
      element.setAttribute("width", "" + 100 / numberOfKeys + "%");
      container.appendChild(element);
      if (i % 12 === 11) {
        startOctave++
      }
    }
  }

  buildOctave(container, className, startNote) {
    const numberOfKeys = 13;

    this.buildPiano(this.OCTAVE_CLASS, numberOfKeys, startNote, 0, false);
  }

  changeNote(frequency) {
    const note = Tone.Frequency(frequency).toNote(); //todo change to native
    if (!note || note === "undefined-Infinity" || note === "undefinedNaN") {
      return;
    }

    this.last5Values.queue(note);
    if (this.last5Values.count(note) >= 3) { //todo ist das gut?
      this.noteContainer.innerHTML = frequency.toFixed(0) + " Hz  Note: " + note;
      if (this.currentNote !== note) {
        this.changeKeysTo(note);
      }
    }
  }

  changeKeysTo(newNote) {
    const oldNote = this.currentNote;
    const oldKey = document.getElementById(this.containerId + NoteDisplay.convertNoteStringToId(oldNote));
    const newKey = document.getElementById(this.containerId + NoteDisplay.convertNoteStringToId(newNote));
    const oldOctaveKey = document
      .getElementById(this.containerId + NoteDisplay.convertNoteStringToId(oldNote).replace(/[0-9]/g, ""));
    const newOctaveKey = document
      .getElementById(this.containerId + NoteDisplay.convertNoteStringToId(newNote).replace(/[0-9]/g, ""));
    if (!newKey || !oldKey || !oldOctaveKey || !newOctaveKey) {
      // console.log("ohoh")
      // console.log(newKey, oldKey, oldOctaveKey, newOctaveKey)
      return;
    }
    oldKey.classList.remove(this.ACTIVE_KEY_CLASS_NAME);
    newKey.classList.add(this.ACTIVE_KEY_CLASS_NAME);
    oldOctaveKey.classList.remove(this.ACTIVE_KEY_CLASS_NAME);
    newOctaveKey.classList.add(this.ACTIVE_KEY_CLASS_NAME);

    this.currentNote = newNote;
  }


  static convertNoteStringToId(noteString) {
    return "note-" + noteString.replace("#", "_");
  }

  static isBlackKey(noteString) { //todo make static
    return noteString.includes("#");
  }

  static frequencyToMidi(f){
    return Math.log(f/27.5)/NoteDisplay.log12sqrt2;
  }

  static midiToNote(m){

  }

}

class Canvas{
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.canvasCtx = canvas.getContext("2d");
    this.HEIGHT = 400;
    this.WIDTH = 1024;
    this.length = this.WIDTH;
    this.sliceWidth = 1;

    this.canvas.setAttribute("width", this.WIDTH);
    this.canvas.setAttribute("height", this.HEIGHT);
  }

  plotCorrelationAndMax(n, idx){
    this.canvasCtx.fillStyle = 'rgb(255, 255, 255)';
    this.canvasCtx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
    this.canvasCtx.lineWidth = 2;
    this.canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    this.canvasCtx.beginPath();
    this.canvasCtx.moveTo(0, (this.HEIGHT /2) * (1 - n[0]))
    for(let i = 1, x = this.sliceWidth; i < this.length; i++, x+=this.sliceWidth) {
      this.canvasCtx.lineTo(x, (this.HEIGHT /2) * (1 - n[i]));
    }
    this.canvasCtx.stroke();

    this.canvasCtx.strokeStyle = 'rgb(255, 0, 0)';
    this.canvasCtx.beginPath();
    console.log(idx*this.sliceWidth);
    this.canvasCtx.moveTo(idx*this.sliceWidth, 0);
    this.canvasCtx.lineTo(idx*this.sliceWidth, this.HEIGHT);
    this.canvasCtx.stroke();
  }

}

document.getElementById("start").addEventListener("click", init)
console.log("loaded");
