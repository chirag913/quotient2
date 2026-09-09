export function csvCell(value:unknown){
 let text=String(value??'');
 if(/^[\s]*[=+@-]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
export function indiaDays(now=new Date()){
 const offset=330*60*1000;
 const shifted=new Date(now.getTime()+offset);
 const midnight=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate())-offset;
 return Array.from({length:7},(_,i)=>{const start=new Date(midnight-(6-i)*86400000);return {start:start.toISOString(),end:new Date(start.getTime()+86400000).toISOString(),label:new Intl.DateTimeFormat('en',{weekday:'short',timeZone:'Asia/Kolkata'}).format(start)}});
}
