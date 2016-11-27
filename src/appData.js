var d3 = require('d3');
import _ from 'supergroup';
import * as util from './utils';

export function distfetch(params) {
  params = _.clone(params);
  let {ntiles, concept_id, bundle, maxgap} = params;
  if (!_.isNumber(ntiles)) throw new Error("need ntiles param, number");
  if (!_.isNumber(concept_id)) throw new Error("need concept_id param, number");
  if (typeof maxgap !== "undefined") {
    params.maxgap = parseInt(maxgap, 10);
  }
  params.ntileOrder = params.ntileOrder || 'gap'; // or duration
  params.bundle = params.bundle || 'exp'; // or era or single

  params.aggregate = true;
  params.resultsSchema = 'omop5_synpuf_5pcnt_results';

  params.noLimit = true;

  return (util.cachedPostJsonFetch(
          //'http://localhost:3000/api/daysupplies/dsgpPost', params)
          'http://localhost:3000/api/cdms/sqlpost', params)
          
          .then(function(json) {
            let recs = json.map( rec => {
                rec.count = parseInt(rec.count, 10);
                if (params.bundle === 'exp') {
                  rec.exp_num = parseInt(rec.exp_num, 10);
                } else if (params.bundle === 'era') {
                  rec.era_num = parseInt(rec.era_num, 10);
                } else if (params.bundle === 'allexp') {
                } else {
                  throw new Error("not handling yet");
                }
                rec.avg = parseFloat(rec.avg);
                if (isNaN(rec.avg))
                  rec.avg = null;
                // ntile, min and max already numbers
                rec.ntileOrder = rec.ntileorder;
                delete rec.ntileorder;
                return rec;
              }
            );
            return recs;
            //var byExp = _.supergroup(recs, ['exp_num','ntile']);
            //return byExp;
          }));
}
