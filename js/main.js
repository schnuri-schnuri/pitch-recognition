"use strict";
import * as Tone from 'tone'; //todo remove

const NOTES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
const WHITE_KEY_CLASS_NAME = "white-key";
const BLACK_KEY_CLASS_NAME = "black-key";
const ACTIVE_KEY_CLASS_NAME = "active";
const FFT_CONTAINER_ID = "fft-container";
const AC_CONTAINER_ID = "ac-container"
const PIANO_CLASS = "piano";
const OCTAVE_CLASS = "octave";
const NOTE_CONTAINER_CLASS = "note-container";

let currentNote = {}
currentNote[FFT_CONTAINER_ID] = "E1";
currentNote[AC_CONTAINER_ID] = "E1";


console.log(currentNote)

let fftNoteContainer;
let acNoteContainer;
let audioCtx;
let source;
let analyser;
let binWidth;


//todo
var canvas = document.getElementById("canvas");
console.log(canvas);
var canvasCtx = canvas.getContext("2d");

// var canvas2 = document.getElementById("canvas2");
// console.log(canvas2);
// var canvas2Ctx = canvas2.getContext("2d");

function init() {
  buildPiano(FFT_CONTAINER_ID, PIANO_CLASS, 50, "E", 1);
  buildOctave(FFT_CONTAINER_ID, OCTAVE_CLASS, "C");
  buildPiano(AC_CONTAINER_ID, PIANO_CLASS, 50, "E", 1);
  buildOctave(AC_CONTAINER_ID, OCTAVE_CLASS, "C");

  document.getElementById("start").remove();
  fftNoteContainer = document.querySelector("#" + FFT_CONTAINER_ID + " > ." + NOTE_CONTAINER_CLASS);
  acNoteContainer = document.querySelector("#" + AC_CONTAINER_ID + " > ." + NOTE_CONTAINER_CLASS); //todo
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = 0.85;
  analyser.fftSize = 2048; //todo changed from 32768;
  binWidth = audioCtx.sampleRate / analyser.frequencyBinCount;


  const lowPassFilterNode = new BiquadFilterNode(audioCtx, {type: "lowpass", frequency: 1245});
  const highPassFilterNode = new BiquadFilterNode(audioCtx, {type: "highpass", frequency: 78});

  console.log(navigator.mediaDevices.getUserMedia);

  navigator.mediaDevices.getUserMedia({audio: true})
    .then(
      function (stream) {
        source = audioCtx.createMediaStreamSource(stream);
        //source.connect(analyser)
        source.connect(lowPassFilterNode); //todo because we need it for fft but not for ac
        lowPassFilterNode.connect(highPassFilterNode);
        highPassFilterNode.connect(analyser);

        analysePitch()
      });
}

function analysePitch() {
  performFFT();
  performAC();
  requestAnimationFrame(analysePitch);
}

function performFFT(){
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  const maxVal = Math.max(...dataArray)

  const frequency = dataArray.indexOf(maxVal) * binWidth / 4;
  changeNoteInContainer(FFT_CONTAINER_ID, fftNoteContainer, frequency);
}

function performAC() {
  const arrayLen = analyser.frequencyBinCount;
  const W = arrayLen;
  const t = 0;
  const k = 0.95;

  const dataArray = new Float32Array(arrayLen);
  analyser.getFloatTimeDomainData(dataArray);
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

  const idx = getBestValueFromAC(n, k);
  const f = audioCtx.sampleRate/idx;
  changeNoteInContainer(AC_CONTAINER_ID, acNoteContainer, f);

  plotArray(n);
}

function changeNoteInContainer(containerId, noteContainer, frequency){
  const note = Tone.Frequency(frequency).toNote(); //todo change to native
  if (note && note !== "undefined-Infinity" && note !== "undefinedNaN") {
    noteContainer.innerHTML = frequency.toFixed(0) + " Hz  Note: " + note;
    if(currentNote[containerId] !== note){
      changeKeysFromTo(containerId, note);
    }

  }
}

function plotArray(n){
  const HEIGHT = 400;
  const WIDTH = 1024;
  const LENGTH = WIDTH;
  const sliceWidth = 1; //WIDTH * 1.0 / LENGTH;

  canvasCtx.fillStyle = 'rgb(255, 255, 255)';
  canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

  canvasCtx.beginPath();
  canvasCtx.moveTo(0, (HEIGHT /2) * (1 - n[0]))
  for(let i = 1, x = sliceWidth; i < LENGTH; i++, x+=sliceWidth) {
    canvasCtx.lineTo(x, (HEIGHT /2) * (1 - n[i]));
  }
  canvasCtx.stroke();
}


function getBestValueFromAC(n, k){ //n: array, k threshold constant
  let maxIndexes = [];
  let absoluteMax = 0
  let currentMax = 0;
  let absoluteMaxIndex = 1;
  let currentMaxIndex = 1;
  for(let i = 1; i < n.length; i++){ //we ignore the first value
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

  const threshold = k * absoluteMax;

  for(let i = 1; i < maxIndexes.length; i++){
    if(n[maxIndexes[i]] > threshold){
      return maxIndexes[i];
    }
  }

  return -1;
}


function changeKeysFromTo(containerId, newNote) {
  const oldNote = currentNote[containerId]
  const oldKey = document.getElementById(containerId + convertNoteStringToId(oldNote));
  const newKey = document.getElementById(containerId + convertNoteStringToId(newNote));
  const oldOctaveKey = document
    .getElementById(containerId + convertNoteStringToId(oldNote).replace(/[0-9]/g, ""));
  const newOctaveKey = document
    .getElementById(containerId + convertNoteStringToId(newNote).replace(/[0-9]/g, ""));
  if (!newKey || !oldKey || !oldOctaveKey || !newOctaveKey) {
    return;
  }
  oldKey.classList.remove(ACTIVE_KEY_CLASS_NAME);
  newKey.classList.add(ACTIVE_KEY_CLASS_NAME);
  oldOctaveKey.classList.remove(ACTIVE_KEY_CLASS_NAME);
  newOctaveKey.classList.add(ACTIVE_KEY_CLASS_NAME);

  currentNote[containerId] = newNote;
}


function getIHighest(arr, i) {
  return arr.sort().slice(-i).reverse();
}

function getIndices(arr, slice) {
  return slice.map(element => arr.indexOf(element));
}

function buildPiano(containerId, pianoClass, numberOfKeys, startNote, startOctave, numbers = true) {
  let noteIndex = NOTES.indexOf(startNote);
  const selector = "#" + containerId + " > ." + pianoClass;

  const container = document.querySelector(selector);
  for (let i = noteIndex; i < numberOfKeys + noteIndex; i++) {
    let element = document.createElement("span");
    element.id = containerId + convertNoteStringToId(NOTES[i % 12] + (numbers ? startOctave : ""));
    if (isBlackKey(NOTES[i % 12])) {
      element.className = BLACK_KEY_CLASS_NAME;
      element.innerHTML = "#";
    } else {
      element.className = WHITE_KEY_CLASS_NAME;
      element.innerHTML = "" + NOTES[i % 12] + (numbers ? startOctave : "");
    }
    element.setAttribute("width", "" + 100 / numberOfKeys + "%");
    container.appendChild(element);
    if (i % 12 === 11) {
      startOctave++
    }
  }
}

function convertNoteStringToId(noteString) {
  return "note-" + noteString.replace("#", "_");
}

function isBlackKey(noteString) {
  return noteString.includes("#");
}

function buildOctave(container, className, startNote) {
  const numberOfKeys = 13;
  buildPiano(container, className, numberOfKeys, startNote, 0, false);
}

class FixedLengthQueue{
  constructor(length){
    this.length = length;
  }

  q = [];

  queue(elem){
    this.q.push(elem);
    if(this.q.length > this.length){
      this.q.shift();
    }
  }

  unQueue(){
    return this.q.shift();
  }

}

// class AutoCorrelator(){
//
// }


document.getElementById("start").addEventListener("click", init)
console.log("loaded");
