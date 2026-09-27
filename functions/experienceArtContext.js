function experienceArtContext(exp = {}) {
  return JSON.stringify({artVersion:2,name:String(exp.name || "").trim().slice(0,120),location:String(exp.location || "").trim().slice(0,200),type:String(exp.type || "").trim().slice(0,80),story:String(exp.story || "").trim().slice(0,500)});
}
module.exports = {experienceArtContext};
