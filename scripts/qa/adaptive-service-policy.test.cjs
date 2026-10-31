"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { AdaptiveServiceKind, POLICY_SCHEMA, defaultAdaptiveServicePolicy,
  validateAdaptiveServicePolicy } = require("../../apps/api/dist/adaptive/adaptive-service-policy");
const kinds = ["appointment","item","project","group","event","product","digital","recurring","live"];
test("all nine published workflows have valid and complete defaults",()=>{
  assert.equal(Object.keys(POLICY_SCHEMA).length,9);
  for(const kind of kinds){
    const defaults=defaultAdaptiveServicePolicy(kind);
    assert.deepEqual(validateAdaptiveServicePolicy(kind,defaults),defaults);
    assert.ok(Object.keys(defaults).length>2);
  }
});
test("capacity cannot exceed personnel or stations",()=>{
  assert.throws(()=>validateAdaptiveServicePolicy("appointment",{
    availableProfessionals:3,availableStations:2,concurrentCapacity:3
  }),/Concurrent capacity/);
  const valid=validateAdaptiveServicePolicy("appointment",{
    availableProfessionals:5,availableStations:3,concurrentCapacity:3
  });
  assert.equal(valid.concurrentCapacity,3);
});
test("consultation credits require active paid consultation",()=>{
  assert.throws(()=>validateAdaptiveServicePolicy("appointment",{
    consultationMode:"disabled",consultationFeeMinor:1000,creditConsultation:true
  }),/Disabled consultations/);
  assert.throws(()=>validateAdaptiveServicePolicy("appointment",{
    consultationMode:"optional",consultationFeeMinor:0,creditConsultation:true
  }),/paid consultation/);
  const valid=validateAdaptiveServicePolicy("appointment",{
    consultationMode:"optional",consultationFeeMinor:100000,creditConsultation:true
  });
  assert.equal(valid.creditConsultation,true);
});
test("laundry intake and return can be selected independently",()=>{
  const x=validateAdaptiveServicePolicy("item",{
    itemType:"laundry",handoverMethods:["home_pickup","drop_off"],
    returnMethods:["home_delivery","shop_pickup"],turnaroundHours:72
  });
  assert.deepEqual(x.handoverMethods,["home_pickup","drop_off"]);
  assert.deepEqual(x.returnMethods,["home_delivery","shop_pickup"]);
  assert.equal(x.notifyWhenReady,true);
});
test("laundry never asks for body measurements",()=>{
  assert.throws(()=>validateAdaptiveServicePolicy("item",{
    itemType:"laundry",measurementMethods:["home_visit"]
  }),/body measurements/);
});
test("tailors support guided or in-person sizing, never contradictory modes",()=>{
  const p=validateAdaptiveServicePolicy("item",{
    itemType:"tailoring",measurementMethods:["shop_visit","guided_remote"]
  });
  assert.deepEqual(p.measurementMethods,["shop_visit","guided_remote"]);
  assert.throws(()=>validateAdaptiveServicePolicy("item",{
    itemType:"tailoring",measurementMethods:["not_required","home_visit"]
  }),/either no measurements/);
});
test("group tutorials enforce bounded seats and sessions",()=>{
  const p=validateAdaptiveServicePolicy("group",{maxParticipants:6,sessionCount:3,sessionMinutes:90});
  assert.equal(p.maxParticipants,6);
  assert.throws(()=>validateAdaptiveServicePolicy("group",{maxParticipants:0}),/maxParticipants/);
  assert.throws(()=>validateAdaptiveServicePolicy("group",{sessionCount:1000}),/sessionCount/);
});
test("digital commissions have bounded revisions and deadlines",()=>{
  assert.equal(validateAdaptiveServicePolicy("digital",{revisionRounds:3,estimatedDays:7}).revisionRounds,3);
  assert.throws(()=>validateAdaptiveServicePolicy("digital",{revisionRounds:101}),/revisionRounds/);
});
test("unknown/unsafe fields and incorrect types cannot be stored",()=>{
  assert.throws(()=>validateAdaptiveServicePolicy("appointment",{autoReleaseEscrow:true}),/Unknown/);
  assert.throws(()=>validateAdaptiveServicePolicy("appointment",{availableProfessionals:"5"}),/whole number/);
  assert.throws(()=>validateAdaptiveServicePolicy("item",{handoverMethods:[]}),/unique choices/);
  assert.throws(()=>validateAdaptiveServicePolicy("item",{handoverMethods:["courier","courier"]}),/unique choices/);
  assert.throws(()=>validateAdaptiveServicePolicy("digital",[]),/object/);
  assert.throws(()=>validateAdaptiveServicePolicy("digital",null),/object/);
  const x=JSON.parse('{"__proto__":{"admin":true}}');
  assert.throws(()=>validateAdaptiveServicePolicy("item",x),/Invalid policy key/);
  assert.equal(({}).admin,undefined);
});
