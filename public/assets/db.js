import {empty,validateBackup} from './core.js';
let database;
export function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('rsas-registration',1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>{database=req.result;resolve();};req.onerror=()=>reject(req.error);});}
export function read(){return new Promise((resolve,reject)=>{const req=database.transaction('state').objectStore('state').get('data');req.onsuccess=()=>resolve(req.result?validateBackup(req.result):empty());req.onerror=()=>reject(req.error);});}
// Read and write in one transaction, including across browser tabs.
export function update(fn){return new Promise((resolve,reject)=>{const tx=database.transaction('state','readwrite'),store=tx.objectStore('state');let value;const req=store.get('data');req.onsuccess=()=>{try{value=validateBackup(fn(req.result?validateBackup(req.result):empty()));store.put(value,'data');}catch(e){reject(e);tx.abort();}};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Penyimpanan dibatalkan.'));});}
