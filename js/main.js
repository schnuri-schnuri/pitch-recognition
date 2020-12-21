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
  analyser.fftSize = 32768;
  binWidth = audioCtx.sampleRate / analyser.frequencyBinCount;


  const lowPassFilterNode = new BiquadFilterNode(audioCtx, {type: "lowpass", frequency: 1245});
  const highPassFilterNode = new BiquadFilterNode(audioCtx, {type: "highpass", frequency: 78});

  console.log(navigator.mediaDevices.getUserMedia);

  navigator.mediaDevices.getUserMedia({audio: true})
    .then(
      function (stream) {
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(lowPassFilterNode);
        lowPassFilterNode.connect(highPassFilterNode);
        highPassFilterNode.connect(analyser);

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
  const W = arrayLen/2;
  const t = 0;

  const dataArray = new Uint8Array(arrayLen);
  analyser.getByteTimeDomainData(dataArray);

  let r = new Uint16Array(W).fill(0);
  let m = new Uint16Array(W).fill(0);

  for(let tau = 0; tau < W; tau++){
    for(let j = t; j < t + W - tau; j++){
      r[tau] += dataArray[j] * dataArray[j+tau];
      m[tau] += Math.pow(dataArray[j],2) + Math.pow(dataArray[j+tau],2);
    }
  }

  let n = r.map((v,i) => 2 * v / m[i]);

  let max = Math.max(...n);
  let maxIndex = n.indexOf(max);

  console.log(max, maxIndex);

  //todo
  const HEIGHT = 200;
  const WIDTH = 1200;

    //drawVisual = requestAnimationFrame(draw);

    //analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    canvasCtx.beginPath();

    var sliceWidth = WIDTH * 1.0 / n.length;
    var x = 0;

    for(var i = 0; i < n.length; i++) {

      var v = n[i] / 128.0;
      var y = v * HEIGHT/2;

      if(i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height/2);
    canvasCtx.stroke();

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
