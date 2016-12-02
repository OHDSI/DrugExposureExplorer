var d3 = require('d3');
import _ from 'supergroup';
import * as util from './utils';

const cdmSchema = 'omop5_synpuf_5pcnt';
const resultsSchema = 'omop5_synpuf_5pcnt_results';

export function recsfetch(params, queryName) {
  params = _.clone(params);
  let {concept_id, bundle, maxgap, person_id} = params;
  if (!_.isNumber(concept_id)) throw new Error("need concept_id param, number");
  if (typeof maxgap !== "undefined") {
    params.maxgap = parseInt(maxgap, 10);
  }
  params.bundle = params.bundle || 'exp'; // or era or single

  params.aggregate = false;
  params.resultsSchema = resultsSchema;
  params.cdmSchema = cdmSchema;

  if (typeof params.person_id === 'undefined') {
    params.noLimit = false;
    params.limit = 5000;
  } else {
    params.noLimit = true;
  }
  params.queryName = queryName || 'no query name';

  return (util.cachedPostJsonFetch(
          //'http://localhost:3000/api/daysupplies/dsgpPost', params)
          'http://localhost:3000/api/cdms/sqlpost', params, queryName)
          
          .then(function(json) {
            if (json.error)
              console.error(json.error.message, json.error.queryName, json.error.url);
            return json;
          }));
}
export function distfetch(params, queryName) {
  params = _.clone(params);
  let {ntiles, concept_id, bundle, maxgap} = params;
  if (!_.isNumber(ntiles)) throw new Error("need ntiles param, number");
  if (!_.isNumber(concept_id)) throw new Error("need concept_id param, number");
  if (typeof maxgap !== "undefined") {
    params.maxgap = parseInt(maxgap, 10);
  }
  params.measurename = params.measurename || 'gap'; // or duration
  params.bundle = params.bundle || 'exp'; // or era or single

  params.aggregate = true;
  params.resultsSchema = resultsSchema;
  params.cdmSchema = cdmSchema;

  params.noLimit = true;

  params.queryName = queryName || 'no query name';

  return (util.cachedPostJsonFetch(
          //'http://localhost:3000/api/daysupplies/dsgpPost', params)
          'http://localhost:3000/api/cdms/sqlpost', params, queryName)
          
          .then(function(json) {
            if (json.error)
              console.error(json.error.message, json.error.url);
            let recs = json.map( rec => {
                rec.count = parseInt(rec.count, 10);
                if (params.bundle === 'exp') {
                  rec.exp_num = parseInt(rec.exp_num, 10);
                } else if (params.bundle === 'era') {
                  rec.era_num = parseInt(rec.era_num, 10);
                } else if (params.bundle === 'allexp') {
                } else if (params.bundle === 'allera') {
                } else {
                  throw new Error("not handling yet");
                }
                rec.avg = parseFloat(rec.avg);
                if (isNaN(rec.avg))
                  rec.avg = null;
                return rec;
              }
            );
            recs.json = json;
            return recs;
            //var byExp = _.supergroup(recs, ['exp_num','ntile']);
            //return byExp;
          }));
}
export function frequentUsers(params, queryName) {
  params = _.clone(params);
  let {concept_id, sampleCnt} = params;
  if (!_.isNumber(concept_id)) throw new Error("need concept_id param, number");
  if (!_.isNumber(sampleCnt)) throw new Error("need sampleCnt param, number");

  params.queryName = queryName;
  params.resultsSchema = resultsSchema;
  params.cdmSchema = cdmSchema;

  return (util.cachedPostJsonFetch(
          'http://localhost:3000/api/cdms/sampleUsersPost', params, queryName)
          .then(function(json) {
            if (json.error)
              console.error(json.error.message, json.error.queryName, json.error.url);
            return json;
          }));
}
