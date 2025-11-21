// Usage: node Converter.js
// nodejs. Take input from stdin
// Automatically decide converting direction

// Based on Pharo Chip save format
// [x][y]
function readAMF(x) {
	if (!x.rdPos) x.rdPos = 0;
	const rd = ()=>/*console.log(x[x.rdPos])||*/x[x.rdPos++];
	const rdInt = (i=4,a=0,b=rd())=>--i?b&128?rdInt(i,a*128+b-128):a*128+b:a*256+b;
	switch (rd()) {
	case 2: return 0;
	case 3: return 1;
	case 4: return rdInt();
	case 9:
		const lenp = rdInt();
		if (!(lenp & 1)) throw "Unsupported: 9/even" + lenp;
		if (rd() != 1) throw "Unsupported: 9/-/" + x[x.rdPos-1];
		return [...Array(lenp>>1)].map(_=>readAMF(x));
	default:
		throw "Unsupported: " + x[x.rdPos-1];
	}
}
function writeAMF(x, buf) {
	const wrInt = (n,f=0)=>{
		if (n < 0 || n >= 2**29 || n%1) throw "Invalid number:" + n;
		if (n >= 0x200000) wrInt(n>>8, 128), buf.push(n&255); else
		if (n >= 128) wrInt(n>>7, 128), buf.push(n&127 | f); else
		buf.push(n | f);}
	if (x == 0) { buf.push(2); return }
	if (x == 1) { buf.push(3); return }
	if (typeof x == 'number') { buf.push(4); wrInt(x); return; }
	if (x instanceof Array) {
		buf.push(9); wrInt(x.length * 2 + 1); buf.push(1); x.map(t=>writeAMF(t, buf)); return; }
	throw "Unsupported Object";
}
function readKOH(x) {
	if (readAMF(x) != 0x2c || readAMF(x) != 0x1b) throw "Bad header";
	const Si = readAMF(x);
	const Me = readAMF(x);
	const Vc = readAMF(x);
	const Hc = readAMF(x);
	const Via = readAMF(x);
	const SiR = readAMF(x);
	const SiD = readAMF(x);
	const MeR = readAMF(x);
	const MeD = readAMF(x);
	return Si.map((r,x)=>r.map((c,y)=>{
		var ret = 1;
		if (Via[x][y]) ret |= 1 << 18;
		if (Me[x][y]) ret |= 1 << 17;
		if ((Vc[x][y] || Hc[x][y]) && Si[x][y]==1) ret |= 1 << 16;
		if ((Vc[x][y] || Hc[x][y]) && Si[x][y]==2) ret |= 1 << 15;
		if (Si[x][y]==1) ret |= 1 << 14;
		if (Si[x][y]==2) ret |= 1 << 13;/*
		if (SiR[x-1]?.[y]) ret |= Hc[x][y] ? 1 << 12 : Hc[x-1]?.[y] ? 0 : 1 << 4;
		if (SiD[x][y]) ret |= Vc[x][y] ? 1 << 11 : Vc[x][y+1] ? 0 : 1 << 3;
		if (SiR[x][y]) ret |= Hc[x][y] ? 1 << 10 : Hc[x+1]?.[y] ? 0 : 1 << 2;
		if (SiD[x][y-1]) ret |= Vc[x][y] ? 1 << 9 : Vc[x][y-1] ? 0 : 1 << 1;*/
		if (SiR[x-1]?.[y]) ret |= Hc[x][y] ? 1 << 12 : 1 << 4;
		if (SiD[x][y]) ret |= Vc[x][y] ? 1 << 11 : 1 << 3;
		if (SiR[x][y]) ret |= Hc[x][y] ? 1 << 10 : 1 << 2;
		if (SiD[x][y-1]) ret |= Vc[x][y] ? 1 << 9 : 1 << 1;
		if (MeR[x-1]?.[y]) ret |= 1 << 8;
		if (MeD[x][y]) ret |= 1 << 7;
		if (MeR[x][y]) ret |= 1 << 6;
		if (MeD[x][y-1]) ret |= 1 << 5;
		return ret;
	}));
}
function writeKOH(s) {
	const buf = [4, 0x2c, 4, 0x1b];
	writeAMF(s.map((r,x)=>r.map((c,y)=>c&(1<<14)?1:c&(1<<13)?2:0)),buf);
	writeAMF(s.map((r,x)=>r.map((c,y)=>c&(1<<17)?1:0)),buf);
	writeAMF(s.map((r,x)=>r.map((c,y)=>c&(1<<9|1<<11)?1:0)),buf);
	writeAMF(s.map((r,x)=>r.map((c,y)=>c&(1<<10|1<<12)?1:0)),buf);
	writeAMF(s.map((r,x)=>r.map((c,y)=>c&(1<<18)?1:0)),buf);
	writeAMF(s.map((r,x)=>r.map((c,y)=>c&(1<<2|1<<10)?1:0)||s[x+1]?.[y]&(1<<12)),buf);
	writeAMF(s.map((r,x)=>r.map((c,y)=>c&(1<<3|1<<11)?1:0)||s[x][y+1]&(1<<9)),buf);
	writeAMF(s.map((r,x)=>r.map((c,y)=>c&(1<<6)?1:0)),buf);
	writeAMF(s.map((r,x)=>r.map((c,y)=>c&(1<<7)?1:0)),buf);
	return Buffer.from(buf);
}
function readPHA(x) {
	const t = x.match(/...../g).map(t=>'0x'+t-0);
	var i = 2, zcnt = 0;
	const tr = [...Array(t[1])].map(_=>[...Array(t[0])].map(_=>
		zcnt ? (zcnt-=2, 1) : (_=t[i++])&1 ? _ : (zcnt=_-2, 1)));
	return tr[0].map((_,y)=>tr.map(r=>r[y]));
}
function writePHA(tr) {
	const x = tr[0].flatMap((_,y)=>tr.map(r=>r[y]))
		.map(c=>c&(1<<17)?c:c&~(1<<18)); // PHA don't support via with Silicon but not Metal
	const st = [tr.length,tr[0].length,...x].map(t=>(1<<20|t).toString(16).slice(1)+',').join('');
	return st.replace(/(00001,){1,65536}/g,e=>(1<<20|e.length/6*2).toString(16).slice(1)).replace(/,/g,'').toUpperCase();
}

const fs = require('fs');
const zlib = require('zlib');
const v = Buffer.from(fs.readFileSync(0,'utf8'),'base64');
if (v[0] == 0x1F) {
	console.log('was PHA\n');
	var x = zlib.deflateSync(writeKOH(readPHA(zlib.gunzipSync(v).toString('utf8'))));
	console.log(x.toString('base64'));
} else {
	console.log('was KOH\n');
	var x = zlib.gzipSync(writePHA(readKOH(zlib.inflateSync(v))));
	console.log(x.toString('base64'));
}
