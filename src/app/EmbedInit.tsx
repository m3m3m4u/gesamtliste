"use client";
import { useEffect, useState } from 'react';

export default function EmbedInit() {
  const need = process.env.NEXT_PUBLIC_REQUIRE_EMBED === '1';
  const [done,setDone] = useState(false);
  useEffect(() => {
    if (!need) return;
    // Versuch Cookie zu setzen
    fetch('/api/embed-set', { method: 'POST', credentials: 'include' })
      .catch(()=>{})
      .finally(()=>setDone(true));
  }, [need]);
  if (!need) return null;
  return <span style={{display:'none'}} data-embed-init={done? 'ok':'pending'} />;
}
