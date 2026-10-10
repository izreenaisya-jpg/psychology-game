'use client';
import {useEffect} from 'react';
export default function GameLoader(){
 useEffect(()=>{const script=document.createElement('script');script.type='module';script.src='/app.js';document.body.appendChild(script);return ()=>{script.remove();};},[]);
 return null;
}
