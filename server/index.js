require('dotenv').config();
const express=require('express'),Database=require('better-sqlite3'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),rate=require('express-rate-limit'),path=require('path');
const content=require('./content.json');
const SECRET=process.env.JWT_SECRET;if(!SECRET||SECRET==='change-me'){console.error('Set a strong JWT_SECRET in .env');process.exit(1)}
// Keep in sync with CFG in public/js/app.js
const XP={lesson:50,quiz:100,perfect:150,challenge:200,perLevel:500};
const db=new Database(process.env.DB_FILE||path.join(__dirname,'ecoquest.db'));db.pragma('journal_mode=WAL');
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,hash TEXT NOT NULL,xp INTEGER DEFAULT 0,streak INTEGER DEFAULT 0,longest INTEGER DEFAULT 0,last TEXT DEFAULT '',created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS progress(user_id INTEGER,kind TEXT,item TEXT,score INTEGER DEFAULT 0,at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,kind,item));
CREATE TABLE IF NOT EXISTS badges(user_id INTEGER,badge TEXT,at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,badge));`);
const cnt=(u,k)=>db.prepare('SELECT COUNT(*) c FROM progress WHERE user_id=? AND kind=?').get(u,k).c;
const has=(u,k,i)=>!!db.prepare('SELECT 1 FROM progress WHERE user_id=? AND kind=? AND item=?').get(u,k,i);
const BADGES={first:[u=>cnt(u,'lesson')>=1,25],seek:[u=>cnt(u,'lesson')>=5,100],water:[u=>has(u,'challenge','water'),75],prot:[u=>cnt(u,'challenge')>=4,200],master:[u=>cnt(u,'quiz')>=Object.keys(content.topics).length,250]};
const day=()=>new Date().toISOString().slice(0,10);
const app=express();app.use(express.json({limit:'10kb'}));
app.use('/api',rate({windowMs:15*60e3,limit:300}));
const authLimit=rate({windowMs:15*60e3,limit:20,message:{error:'Too many attempts, try later.'}});
const sign=u=>jwt.sign({id:u.id},SECRET,{expiresIn:'7d'});
const need=(req,res,next)=>{try{req.uid=jwt.verify((req.headers.authorization||'').replace('Bearer ',''),SECRET).id;next()}catch{res.status(401).json({error:'Unauthorized'})}};
const cred=b=>/^[A-Za-z0-9_]{3,20}$/.test(b?.username||'')&&typeof b.password==='string'&&b.password.length>=8&&b.password.length<=72;
app.post('/api/register',authLimit,(req,res)=>{if(!cred(req.body))return res.status(400).json({error:'Username 3-20 letters/digits/_, password 8-72 chars.'});
 try{const r=db.prepare('INSERT INTO users(username,hash) VALUES(?,?)').run(req.body.username,bcrypt.hashSync(req.body.password,10));res.json({token:sign({id:r.lastInsertRowid})})}catch{res.status(409).json({error:'Username taken'})}});
app.post('/api/login',authLimit,(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE username=?').get(String(req.body?.username||''));
 if(!u||!bcrypt.compareSync(String(req.body.password||''),u.hash))return res.status(401).json({error:'Invalid credentials'});res.json({token:sign(u)})});
const me=id=>{const u=db.prepare('SELECT id,username,xp,streak,longest FROM users WHERE id=?').get(id);return{...u,level:Math.floor(u.xp/XP.perLevel)+1,progress:db.prepare('SELECT kind,item,score FROM progress WHERE user_id=?').all(id),badges:db.prepare('SELECT badge,at FROM badges WHERE user_id=?').all(id)}};
app.get('/api/me',need,(req,res)=>res.json(me(req.uid)));
// Rewards are computed here, never trusted from the client. Each item pays XP once.
app.post('/api/complete',need,(req,res)=>{const{kind,item,answers}=req.body||{};let gain=0,score=0;
 if(kind==='lesson'||kind==='quiz'){if(!content.topics[item])return res.status(400).json({error:'Unknown item'})}
 else if(kind==='challenge'){if(!content.challenges.includes(item))return res.status(400).json({error:'Unknown item'})}else return res.status(400).json({error:'Unknown kind'});
 if(kind==='quiz'){const key=content.topics[item];if(!Array.isArray(answers)||answers.length!==key.length)return res.status(400).json({error:'Bad answers'});score=Math.round(answers.filter((a,i)=>a===key[i]).length/key.length*100)}
 const first=!has(req.uid,kind,item);
 if(first){gain=kind==='quiz'?XP.quiz+(score===100?XP.perfect:0):XP[kind];db.prepare('INSERT INTO progress(user_id,kind,item,score) VALUES(?,?,?,?)').run(req.uid,kind,item,score)}
 else if(kind==='quiz')db.prepare('UPDATE progress SET score=MAX(score,?) WHERE user_id=? AND kind=? AND item=?').run(score,req.uid,kind,item);
 const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.uid),t=day(),y=new Date(Date.now()-864e5).toISOString().slice(0,10);let st=u.streak;
 if(gain&&u.last!==t)st=u.last===y?st+1:1;
 const unlocked=[];for(const[b,[test,xp]]of Object.entries(BADGES))if(!db.prepare('SELECT 1 FROM badges WHERE user_id=? AND badge=?').get(req.uid,b)&&test(req.uid)){db.prepare('INSERT INTO badges(user_id,badge) VALUES(?,?)').run(req.uid,b);gain+=xp;unlocked.push(b)}
 db.prepare('UPDATE users SET xp=xp+?,streak=?,longest=MAX(longest,?),last=? WHERE id=?').run(gain,st,st,gain?t:u.last,req.uid);
 res.json({gain,score,unlocked,profile:me(req.uid)})});
app.get('/api/leaderboard',(req,res)=>{const page=Math.max(1,+req.query.page||1),n=20;
 res.json(db.prepare('SELECT username,xp,streak,(xp/?)+1 AS level,(SELECT COUNT(*) FROM badges b WHERE b.user_id=users.id) AS badges FROM users ORDER BY xp DESC LIMIT ? OFFSET ?').all(XP.perLevel,n,(page-1)*n))});
app.use(express.static(path.join(__dirname,'..','public')));
app.listen(process.env.PORT||3000,()=>console.log('EcoQuest on http://localhost:'+(process.env.PORT||3000)));
