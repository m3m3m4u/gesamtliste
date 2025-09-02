"use client";
import { useEffect, useState } from 'react';

export default function EmbedInit() {
  const need = process.env.NEXT_PUBLIC_REQUIRE_EMBED === '1';
  const [done,setDone] = useState(false);
  useEffect(() => {
    if (!need) return;
    const token = process.env.NEXT_PUBLIC_EMBED_TOKEN;
    fetch('/api/embed-set', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .catch(()=>{})
      .finally(()=>setDone(true));
  }, [need]);
  if (!need) return null;
  return <span style={{display:'none'}} data-embed-init={done? 'ok':'pending'} />;
}
