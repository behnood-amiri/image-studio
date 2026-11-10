// SPDX-License-Identifier: GPL-2.0-or-later
// Maintainer: Behnood Amiri — https://behnoodamiri.ir/
/* Browser-only image processing. No fetch, upload, telemetry or server persistence. */
(() => {
  'use strict';
  const types = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp']);
  const extensions = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
  const MAX_BYTES = 20 * 1024 * 1024, MAX_PIXELS = 24000000, MAX_EDGE = 6000;
  document.querySelectorAll('[data-ba-image-tool]').forEach(root => {
    const el = name => root.querySelector(`[data-image-${name}]`);
    const fileInput=el('file'), width=el('width'), height=el('height'), format=el('format'), quality=el('quality'), ratio=el('ratio');
    const convert=el('convert'), download=el('download'), preview=el('preview'), status=el('status');
    let bitmap=null, sourceUrl=null, outputUrl=null, original=null, revision=0, busy=false;
    const say = text => { status.textContent=text; };
    root.addEventListener('ba:collect-draft',e=>{e.detail.payload={};});
    const bytes = n => `${(n/1024).toLocaleString('fa-IR',{maximumFractionDigits:1})} کیلوبایت`;
    function clearOutput(){if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=null;download.hidden=true;download.removeAttribute('href');preview.hidden=true;preview.querySelector('img').removeAttribute('src');}
    function clear(){revision++;bitmap?.close?.();bitmap=null;if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=null;original=null;clearOutput();convert.disabled=true;fileInput.value='';busy=false;root.removeAttribute('aria-busy');}
    function invalidate(){revision++;busy=false;root.removeAttribute('aria-busy');clearOutput();convert.disabled=!bitmap;}
    async function load(file){
      clear();const ticket=revision;
      if(!file)return;
      if(!types.has(file.type)||file.size>MAX_BYTES||file.size===0){say('تصویر معتبر تا ۲۰ مگابایت انتخاب کنید. فایل SVG یا PDF در این ابزار پذیرفته نمی‌شود.');return;}
      say('در حال خواندن تصویر…');
      try {
        let image;
        if(typeof createImageBitmap==='function') image=await createImageBitmap(file);
        else {const img=new Image();sourceUrl=URL.createObjectURL(file);img.src=sourceUrl;await img.decode();image=img;}
        if(ticket!==revision){image.close?.();return;}
        if(!image.width||!image.height||image.width*image.height>MAX_PIXELS){image.close?.();throw new Error('تصویر بیش از ۲۴ مگاپیکسل است؛ ابتدا تصویر کوچک‌تری انتخاب کنید.');}
        bitmap=image;original=file;const scale=Math.min(1,MAX_EDGE/image.width,MAX_EDGE/image.height);
        width.value=Math.round(image.width*scale);height.value=Math.round(image.height*scale);convert.disabled=false;
        say(`تصویر آماده است: ${bytes(file.size)}. ابعاد و فرمت را انتخاب کنید و پردازش را بزنید.`);
      } catch(error){if(ticket===revision){convert.disabled=true;say(error.message?.startsWith('تصویر بیش')?error.message:'خواندن این تصویر ممکن نیست؛ فرمت پشتیبانی نمی‌شود یا فایل خراب است.');}}
    }
    fileInput.addEventListener('change',()=>load(fileInput.files[0]));
    const drop=root.querySelector('.ba-image-drop');
    ['dragover','dragleave','drop'].forEach(name=>drop.addEventListener(name,event=>{event.preventDefault();drop.classList.toggle('is-dragging',name==='dragover');if(name==='drop')load(event.dataTransfer.files[0]);}));
    width.addEventListener('input',()=>{if(bitmap&&ratio.checked)height.value=Math.max(1,Math.round(Number(width.value)*bitmap.height/bitmap.width));invalidate();});
    height.addEventListener('input',()=>{if(bitmap&&ratio.checked)width.value=Math.max(1,Math.round(Number(height.value)*bitmap.width/bitmap.height));invalidate();});
    [format,ratio].forEach(input=>input.addEventListener('change',invalidate));
    quality.addEventListener('input',()=>{el('quality-value').textContent=`${Number(quality.value).toLocaleString('fa-IR')}٪`;invalidate();});
    convert.addEventListener('click',async()=>{
      if(root.dataset.access==='0'){say('برای فعال شدن خروجی، ابتدا دسترسی را از کادر ثبت و پرداخت تهیه کنید. تصویر شما آپلود نمی‌شود؛ پس از بازگشت آن را دوباره انتخاب کنید.');return;}
      if(!bitmap||busy)return;
      const w=Number(width.value),h=Number(height.value);
      if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>MAX_EDGE||h>MAX_EDGE||w*h>MAX_PIXELS){say('ابعاد باید عدد صحیح ۱ تا ۶۰۰۰ و مجموع کمتر از ۲۴ مگاپیکسل باشد.');return;}
      busy=true;convert.disabled=true;clearOutput();root.setAttribute('aria-busy','true');say('در حال پردازش روی دستگاه شما…');const ticket=++revision;
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      try {
        const ctx=canvas.getContext('2d');if(!ctx)throw new Error('canvas');
        if(format.value==='image/jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);}
        ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('encode')),format.value,Number(quality.value)/100));
        if(ticket!==revision)return;
        const ext=extensions[blob.type];if(!ext)throw new Error('format');
        outputUrl=URL.createObjectURL(blob);download.href=outputUrl;download.download=`${original.name.replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'-')}-behnood.${ext}`;
        download.hidden=false;preview.querySelector('img').src=outputUrl;preview.hidden=false;
        el('info').textContent=`${w.toLocaleString('fa-IR')} × ${h.toLocaleString('fa-IR')} پیکسل · ${bytes(blob.size)}`;
        const delta=Math.round((1-blob.size/original.size)*100);
        say(`${blob.type!==format.value?'مرورگر فرمت انتخابی را پشتیبانی نکرد؛ خروجی PNG با پسوند صحیح آماده شد. ':''}${delta>=0?`${delta.toLocaleString('fa-IR')}٪ کاهش حجم`:`${Math.abs(delta).toLocaleString('fa-IR')}٪ افزایش حجم؛ کیفیت یا ابعاد را کمتر کنید`}. آمادهٔ دانلود.`);
      } catch(_){if(ticket===revision)say('پردازش انجام نشد؛ ابعاد کوچک‌تر یا فرمت JPG را امتحان کنید.');}
      finally{canvas.width=canvas.height=0;if(ticket===revision){busy=false;convert.disabled=!bitmap;root.removeAttribute('aria-busy');}}
    });
    el('reset').addEventListener('click',()=>{clear();say('تصویر از حافظهٔ این ابزار پاک شد. تصویر جدیدی انتخاب کنید.');});
    window.addEventListener('pagehide',clear,{once:true});
  });
})();


