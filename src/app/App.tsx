import React, { useEffect } from 'react';
import { initRetroNote } from './ts/retro';

export default function App() {
  useEffect(() => {
    initRetroNote();
  }, []);
  return <div id="rn-app" />;
}
