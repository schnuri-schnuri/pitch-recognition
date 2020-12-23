"use strict";
import * as Tone from 'tone';

const NOTES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
const WHITE_KEY_CLASS_NAME = "white-key";
const BLACK_KEY_CLASS_NAME = "black-key";
const ACTIVE_KEY_CLASS_NAME = "active";
const PIANO_ID = "piano";
const OCTAVE_ID = "octave";
let currentNote = "E1";

let noteContainer;
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
  buildPiano(PIANO_ID, 50, "E", 1)
  buildOctave(OCTAVE_ID, "C")
  document.getElementById("start").remove();
  noteContainer = document.getElementById("note-container");
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  console.log(audioCtx.sampleRate);

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
        source.connect(analyser)
        // source.connect(lowPassFilterNode); todo because we need it for fft but not for ac
        // lowPassFilterNode.connect(highPassFilterNode);
        // highPassFilterNode.connect(analyser);

        getFFTData()
      });
}

function getFFTData() {

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  const maxVal = Math.max(...dataArray)

  const frequency = dataArray.indexOf(maxVal) * binWidth / 4;
  const newNote = Tone.Frequency(frequency).toNote();

  if (newNote && newNote !== "undefined-Infinity") {
    noteContainer.innerHTML = frequency.toFixed(0) + " Hz  Note: " + newNote;
    changeKeysFromTo(newNote);
  }

  performAC();

  requestAnimationFrame(getFFTData);
}

function performAC() {
  const arrayLen = analyser.frequencyBinCount;
  const W = arrayLen;
  const t = 0;

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

  //todo because i'm dumb i'll try to do it a second time

  // let n2 = new Float32Array(W).fill(0);
  //
  // for(let tau = 0; tau < W; tau++){
  //   for(let j = t; j < t + W - tau; j++){
  //     r[tau] += n[j] * n[j+tau];
  //     m[tau] += Math.pow(n[j],2) + Math.pow(n[j+tau],2);
  //   }
  //   n2[tau] = (2 * r[tau]) / m[tau];
  // }


  // let max = Math.max(...n);
  // let maxIndex = n.indexOf(max);
  //
  // let min = Math.min(...n);
  // let minIndex = n.indexOf(min);
  //
  // console.log(max, maxIndex, min, minIndex, n[1], n[2], n[3], n[4], n[5], n[6], n[100], n[1000]);

  //todo
  const HEIGHT = 400;
  const WIDTH = 1800;

  //drawVisual = requestAnimationFrame(draw);

  //analyser.getByteTimeDomainData(dataArray);

  canvasCtx.fillStyle = 'rgb(200, 200, 200)';
  canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

  canvasCtx.beginPath();

  const LENGTH = WIDTH; //todo

  var sliceWidth = WIDTH * 1.0 / LENGTH; // todo old: n.length;


  console.log(sliceWidth)

  for(let i = 0, x = 0; i < LENGTH; i++, x+=sliceWidth) { //todo

    const y = n[i];
    //var y = v * HEIGHT/4;

    if(i === 0) {
      canvasCtx.moveTo(x, (HEIGHT /2) * (1 - y));
    } else {
      canvasCtx.lineTo(x, (HEIGHT /2) * (1 - y));
    }
  }

  canvasCtx.lineTo(canvas.width, canvas.height/2);
  canvasCtx.stroke();

  // canvas2Ctx.fillStyle = 'rgb(200, 200, 200)';
  // canvas2Ctx.fillRect(0, 0, WIDTH, HEIGHT);
  //
  // canvas2Ctx.lineWidth = 2;
  // canvas2Ctx.strokeStyle = 'rgb(0, 0, 0)';
  //
  // canvas2Ctx.beginPath();
  //
  // for(let i = 0, x = 0; i < LENGTH; i++, x+= sliceWidth) { //todo
  //
  //   const y = n2[i];
  //   //var y = v * HEIGHT/4;
  //
  //   if(i === 0) {
  //     canvas2Ctx.moveTo(x, (HEIGHT /2) * (1 - y));
  //   } else {
  //     canvas2Ctx.lineTo(x, (HEIGHT /2) * (1 - y));
  //   }
  // }
  //
  // canvas2Ctx.lineTo(canvas.width, canvas.height/2);
  // canvas2Ctx.stroke();

}




function changeKeysFromTo(newNote) {

  const oldKey = document.getElementById(PIANO_ID + convertNoteStringToId(currentNote));
  const newKey = document.getElementById(PIANO_ID + convertNoteStringToId(newNote));
  const oldOctaveKey = document
    .getElementById(OCTAVE_ID + convertNoteStringToId(currentNote).replace(/[0-9]/g, ""));
  const newOctaveKey = document
    .getElementById(OCTAVE_ID + convertNoteStringToId(newNote).replace(/[0-9]/g, ""));
  if (!newKey || !oldKey || !oldOctaveKey || !newOctaveKey) {
    return;
  }
  oldKey.classList.remove(ACTIVE_KEY_CLASS_NAME);
  newKey.classList.add(ACTIVE_KEY_CLASS_NAME);
  oldOctaveKey.classList.remove(ACTIVE_KEY_CLASS_NAME);
  newOctaveKey.classList.add(ACTIVE_KEY_CLASS_NAME);
  currentNote = newNote;
}


function getIHighest(arr, i) {
  return arr.sort().slice(-i).reverse();
}

function getIndices(arr, slice) {
  return slice.map(element => arr.indexOf(element));
}

function buildPiano(containerId, numberOfKeys, startNote, startOctave, numbers = true) {
  let noteIndex = NOTES.indexOf(startNote);

  const container = document.getElementById(containerId);
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

function buildOctave(containerId, startNote) {
  const numberOfKeys = 13;
  buildPiano(containerId, numberOfKeys, startNote, 0, false);
}


document.getElementById("start").addEventListener("click", init)
console.log("loaded");
