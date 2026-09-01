import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Short, calcMeta} from './Short.jsx';
import {FPS, W, H} from './theme.js';
import sample from '../content/sample.json';
import sampleAudio from '../content/sample.audio.json';

const Root = () => (
  <Composition
    id="Short"
    component={Short}
    width={W}
    height={H}
    fps={FPS}
    durationInFrames={900}
    defaultProps={{content: sample, audio: sampleAudio}}
    calculateMetadata={calcMeta}
  />
);

registerRoot(Root);
