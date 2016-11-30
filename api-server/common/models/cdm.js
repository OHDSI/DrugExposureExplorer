var loopback = require('loopback').Model;
module.exports = function(cdm){

  var returns = { arg: 'data', type: ['cdm'], root: true };
  cdm.sampleUsersGet = cdm.sampleUsersPost = 
    function(cdmSchema, resultsSchema, concept_id, sampleCnt, 
             measurename, bundle, entityName, maxgap, from, to, queryName, cb) {
      resultsSchema = cdmSchema + '_results';
      var ds = cdm.dataSource;
      let allParams = 
        {cdmSchema, resultsSchema, concept_id, queryName, sampleCnt, 
         maxgap, from, to, bundle, entityName, measurename, measureCol};
      var sql = '', filter = '', measureCol;


      // confusion around bundle and entityName right now...
      // different terms being used sort of same way...have to fix

      switch (entityName) {
        case 'era':
          bundle = 'era';
          break;
        case 'exposure':
          bundle = 'exp';
          break;
        default:
      }

      if (bundle === 'era') {
        measureCol =
          ({ 
            gap: 'btn_era_gap_days',
            exp_count: 'exp_count',
            exposures: 'exposures',
            duration: 'era_days',
            //duration: 'max(drug_exposure_end) - min(drug_exposure_start_date)',
          })[measurename];
        if (typeof from !== 'undefined' && typeof to !== 'undefined') {
          filter =  ` where ${measureCol} between @from and @to `;
        }
        sql = plainEras({resultsSchema, maxgap, concept_id, undefined, undefined, measurename, bundle, entityName, filter});
        sql = ` 
              /* sampleUsers */
              select person_id 
              from (${sql}
              ) plain_eras
              order by ${measureCol} desc 
              limit @sampleCnt `;
      } else if (bundle === 'exp') {
        measureCol =
          ({ 
            gap: 'days_from_latest',
            exp_count: 'exp_num',
            exposures: 'exp_num',
            overlap: 'days_from_latest',
            duration: 'days_supply',
          })[measurename];
        allParams.measureCol = measureCol;
        if (typeof from !== 'undefined' && typeof to !== 'undefined') {
          filter =  ` and ${measureCol} between @from and @to `;
        }
        let filt = '';
        if (measurename === 'overlap') {
          filt = ` and ${measureCol} < 0`
        }
        if (measurename === 'gap') {
          filt = ` and ${measureCol} > 0`
        }
        // can't come up with good way to get exactly sampleCnt
        // top persons
        sql = `
              /* sampleUsers exp */
              select person_id
              from ${resultsSchema}.drug_exposure_rollup
              where rollup_concept_id = @concept_id
              --${filt}
              order by ${measureCol} ${measurename==='overlap' ? 'ASC' : 'DESC'}
              limit 1000`;
        /*
          sql = `
                /* sampleUsers exp but not exp_num * /
                /*
                select person_id 
                from ${cdmSchema}_results.drug_by_person_stats
                where rollup_concept_id = @concept_id
                  ${filter}
                order by ${measureCol} desc 
                limit @sampleCnt 
                * /

                select distinct person_id
                from (
                  select distinct person_id, exp_num
                  from (${sql}
                  ) exposures
                order by ${measureCol} desc 
                ) p
                limit @sampleCnt `;
        */
      } else {
        console.error(`don't know what to do with bundle ${bundle}`, allParams);
      }
      let numParams = {concept_id, sampleCnt, maxgap, from, to};
      sql = resolveParams(sql, numParams);
      console.log('==============>\n', allParams, sql, '\n<==============\n');
      ds.connector.query(sql, [], function(err, rows) {
        if (err) console.error(err);
        cb(err, rows);
      });
    };

  var sampleUsersAccepts = [
      {arg: 'cdmSchema', type: 'string', required: true },
      {arg: 'resultsSchema', type: 'string', required: false},
      {arg: 'concept_id', type: 'number', required: false},
      {arg: 'sampleCnt', type: 'number', required: false, default: 2},
      {arg: 'measurename', type: 'string', required: true, },
      {arg: 'bundle', type: 'string', required: true, },
      {arg: 'entityName', type: 'string', required: false, },
      {arg: 'maxgap', type: 'number', required: false},
      {arg: 'from', type: 'number', required: false, },
      {arg: 'to', type: 'number', required: false, },
      {arg: 'queryName', type: 'string', required: false, default: 'No query name'},
  ];

  cdm.remoteMethod('sampleUsersGet', {
    accepts: sampleUsersAccepts,
    returns,
    accessType: 'READ',
    http: {
      verb: 'get'
    }
  });
  cdm.remoteMethod('sampleUsersPost', {
    accepts: sampleUsersAccepts,
    returns,
  });

  cdm.sqlget = cdm.sqlpost = 
    function(aggregate, bundle, cdmSchema, resultsSchema, concept_id, person_id, 
             maxgap, ntiles, measurename, limit=2000, noLimit, queryName, cb) {
      var ds = cdm.dataSource;
      /*
       * can't figure out how to verify schema names or find schemas,
       *  so i'm just going to do something super unsafe
      console.log(ds.settings);
      var schemas = ds.discoverSchemasSync('cdm');
      console.log(schemas);
      var schemas2 = cdmDS.discoverSchemasSync('cdm');
      console.log(schemas2);
      var cdmDS = this.getDataSource(cdmSchema);
      var resultsDS = this.getDataSource(resultsSchema);
      console.log(resultsDS.settings);
      var cdmSchemaNameTrusted = cdmDS.settings.schema;
      var resultsSchemaNameTrusted = resultsDS.settings.schema;
      console.log(`cdm: ${cdmSchema}/${cdmSchemaNameTrusted}, results: ${resultsSchema}/${resultsSchemaNameTrusted}`);
      //console.log(resultsSchema, resultsDS.settings);
      */
      var sql; 
      var drugName = false; // whether to include it in rollup_exposure - only for non-aggregate exp
      if (!aggregate) {
        switch(bundle) {
          case 'exp':
            drugName = true;
          case 'allexp':
            sql = exposure_rollup({resultsSchema, concept_id, person_id, ntiles, measurename, bundle, drugName});
            sql += '\norder by person_id, rollup_concept_id, exp_num';
            if (sql.match(/ntiles/)) sql += ', ntiles';
            break;
          case 'era':
          case 'allera':
            sql = eras({resultsSchema, maxgap, concept_id, person_id, ntiles, measurename, bundle});
            sql += '\norder by person_id, rollup_concept_id, era_num';
            if (sql.match(/ntiles/)) sql += ', ntiles';
            break;
          case 'single':
            //sql = exposure_rollup({resultsSchema, concept_id, person_id, ntiles, measurename, limit});
            break;
        }
      } else {
        switch(bundle) {
          case 'exp':
          case 'allexp':
            sql = exposure_rollup({resultsSchema, concept_id, person_id, ntiles, measurename, bundle});
            sql = ntileCross(sql, {resultsSchema, concept_id, person_id, ntiles, measurename, bundle});
            break;
          case 'era':
          case 'allera':
            sql = eras({resultsSchema, maxgap, concept_id, person_id, ntiles, measurename, bundle});
            sql = ntileCross(sql, {resultsSchema, concept_id, person_id, ntiles, measurename, bundle});
            break;
          case 'single':
            //sql = exposure_rollup({resultsSchema, concept_id, person_id, ntiles, measurename, limit});
            break;
        }
      }
      let limitStr = '';
      if (!noLimit) {
        limitStr = `limit @limit`;
      }
      sql = `${sql} ${limitStr}`;
      let numParams = {concept_id, person_id, maxgap, ntiles, limit};
      sql = resolveParams(sql, numParams);
      let allParams = {aggregate, bundle, cdmSchema, resultsSchema, concept_id, person_id, 
             maxgap, ntiles, measurename, noLimit, queryName, drugName};
      console.log('==============\n', allParams, sql, '\n<==============\n');
      ds.connector.query(sql, [], function(err, rows) {
        if (err) console.error(err);
        cb(err, rows);
      });
    };

  var accepts = [
      {arg: 'aggregate', type: 'boolean', required: true, default: false},
      {arg: 'bundle', type: 'string', required: true,
                description: 'exp, era, or single'},
      //{arg: 'request', type: 'string', required: true},
      {arg: 'cdmSchema', type: 'string', required: false},
      {arg: 'resultsSchema', type: 'string', required: false},
      {arg: 'concept_id', type: 'number', required: false},
      {arg: 'person_id', type: 'number', required: false},
      {arg: 'maxgap', type: 'number', required: false},
      {arg: 'ntiles', type: 'number', required: false},
      {arg: 'measurename', type: 'string', required: false,
              description: 'should be duration, gap, or overlap'},
      {arg: 'limit', type: 'number', required: false},
      {arg: 'noLimit', type: 'boolean', required: false, default: false},
      {arg: 'queryName', type: 'string', required: false, default: 'No query name'},
  ];
  cdm.remoteMethod('sqlget', {
    accepts,
    returns,
    accessType: 'READ',
    http: {
      verb: 'get'
    }
  });
  cdm.remoteMethod('sqlpost', {
    accepts,
    returns,
  });
  function resolveParams(sql, params) {
    // doing this this way so I can use real sql parameterization later
    //console.log(sql, params);
    return  sql.replace(/@(\w+)/g, function(match, token) {
              return params[token];
            });
  }
  function ntileCol(p, whereArr) {
    // may modify whereArr
    let {ntiles, measurename, bundle, entityName} = p;

    if (typeof ntiles === 'undefined' || typeof measurename === 'undefined')
      return '';

    let partition = ({
        exp: 'partition by exp_num', 
        era: 'partition by era_num', 
        allexp: '',
        allera: '',
    })[bundle];

    let order = ({
      duration: {
        exp: 'days_supply', 
        allexp: 'days_supply', 
        era: 'total_days_supply', 
        allera: 'total_days_supply', 
      },
      gap: {
        exp: 'days_from_latest', 
        allexp: 'days_from_latest', 
        era: 'btn_era_gap_days', 
        allera: 'btn_era_gap_days', 
      },
      overlap: {
        exp: 'exp_overlap_days', 
        allexp: 'exp_overlap_days', 
        era: 'NO_ERA_OVERLAP',
        allera: 'NO_ERA_OVERLAP',
      },
    })[measurename][bundle];

    if (measurename === 'gap' || measurename === 'overlap') {
      if (bundle === 'exp')
        whereArr.push(`exp_num > 1`);
      //if (bundle === 'allexp') whereArr.push(`exp_num > 1`); shouldn't matter
      if (bundle === 'era')
        whereArr.push(`era_num > 1`);
    }

    sql = `
                                      /* ntileCol */
                                      ntile(@ntiles) over (${partition} order by ${order}) ntile, `;
    return sql;
  }
  function exposure_rollup(p, parameterize) {
    let {resultsSchema, concept_id, person_id, ntiles, 
          measurename, bundle, entityName, drugName} = p;
    let where = [];
    if (typeof concept_id !== 'undefined') {
      where.push(`rollup_concept_id = @concept_id`);
    }
    if (typeof person_id !== 'undefined') {
      where.push(`person_id = @person_id`);
    }

    let ntilecol =
          (typeof ntiles === 'undefined' || typeof measurename === 'undefined')
          ? ''
          : ntileCol({ntiles, measurename, bundle, entityName}, where);

    let whereClause = '';
    if (where.length) {
      whereClause = `where ${where.join(' and ')}`;
    }
    let sql = `
                              select 
                                      drug_exposure_start_date -
                                        first_value(drug_exposure_start_date) 
                                          over (order by exp_num)
                                        as days_from_first,
                                      case when days_from_latest > 0 
                                          then days_from_latest else 0 end as exp_gap_days,
                                     case when days_from_latest < 0 
                                          then
                                              case when -days_from_latest > days_supply 
                                                   then days_supply
                                                   else -days_from_latest
                                              end
                                          else 0 
                                     end as exp_overlap_days,
                                     d.*
                                     ${drugName ? ',c.concept_name as drug_name' : ''}
                              from ${resultsSchema}.drug_exposure_rollup d
                              ${
                                  drugName ?
                                    'join omop5_synpuf_5pcnt.concept c on d.drug_concept_id = c.concept_id'
                                    : ''
                              }
                              ${whereClause}
                              `;
    if (ntilecol) {
      sql = `
                              select ${ntilecol}
                                      er_no_ntile.*
                              from (${sql}
                              ) er_no_ntile `;
    }
    sql = `
                              /* exposure_rollup(${JSON.stringify(p)}) */
                              ${sql}`;

    return sql;
  }
  function ntileCross(sql, p, parameterize) {
    let {resultsSchema, concept_id, person_id,
              ntiles, measurename, bundle, entityName} = p;

    let aggs = {
      exp:    { duration: 'days_supply',        gap: 'days_from_latest', overlap: 'exp_overlap_days' },
      allexp: { duration: 'days_supply',        gap: 'days_from_latest', overlap: 'exp_overlap_days' },
      era:    { duration: 'total_days_supply',  gap: 'btn_era_gap_days' },
      allera: { duration: 'total_days_supply',  gap: 'btn_era_gap_days' },
    };
    let agg = aggs[bundle][measurename];

    let first_exp = ({duration: 1, gap: 2, overlap: 2})[measurename];

    let bundleCol = ({ exp: 'exp_num', era: 'era_num', allexp: null, allera: null })[bundle];

    if (!bundleCol) { // intentional weird indenting here so sql indenting comes
                      // out readable
      let crossNums = `
        /* ntileCross crossNums cn */
        select generate_series as cn_ntile
        from generate_series(1,@ntiles)
        `;
      let withEmptyNtiles = `
      /* ntileCross withEmptyNtiles wen */
      select cn.*, dern.*
      from (${crossNums}
      ) cn
      left outer join (${sql}) dern
        on cn.cn_ntile = dern.ntile `;
      sql = `
    /* ntileCross(${JSON.stringify(p)}) */
    select  '${agg}' as aggField,
            '${measurename}' as measurename,
            cn_ntile as ntile,
            count(${agg}) as count,
            min(${agg}), max(${agg}), avg(${agg})
    from (${withEmptyNtiles}
    ) wen
    group by 1,2,3
    order by 2,3 `;
      return sql;
    }
    let max_exp = `
          /* ntileCross max_exp */
          select max(${bundleCol}) 
          from (${sql}
          ) s `;
    let crossNums = `
        /* ntileCross crossNums cn */
        select generate_series as cn_${bundleCol}, b.ntile as cn_ntile
        from generate_series(${first_exp}, (${max_exp}
        ))
        join (select generate_series as ntile 
              from generate_series(1,@ntiles)) b on 1=1
        `;
    let withEmptyNtiles = `
      /* ntileCross withEmptyNtiles wen */
      select cn.*, dern.*
      from (${crossNums}
      ) cn
      left outer join (${sql}) dern
        on cn.cn_ntile = dern.ntile and cn.cn_${bundleCol} = dern.${bundleCol} `;
    sql = `
    /* ntileCross(${JSON.stringify(p)}) */
    select  '${agg}' as aggField,
            '${measurename}' as measurename,
            cn_${bundleCol} as ${bundleCol},
            cn_ntile as ntile,
            count(${bundleCol}) as count,
            min(${agg}), max(${agg}), avg(${agg})
    from (${withEmptyNtiles}
    ) wen
    group by 1,2,3,4
    order by 3,4 `;
    return sql;
  }

  function plainEras(p) {
    let {resultsSchema, maxgap, concept_id, person_id, ntiles, measurename, bundle, filter} = p;
    return `
              /* plainEras(${JSON.stringify(p)}) */
              select
                      person_id,
                      era_num,
                      count(*) as exposures,
                      min(era_days) as era_days, /* same in every value, so min,max,avg, doesn't matter */
                      /*max(drug_exposure_end) - min(drug_exposure_start_date) as era_days, */
                      sum(days_supply) as total_days_supply,
                      min(btn_era_gap_days) as btn_era_gap_days,
                      min(from_exp) as from_exp,
                      min(to_exp) as to_exp,
                      min(era_start_date) as era_start_date,
                      min(era_end_date) as era_end_date,
                      min(days_from_first_era) as days_from_first_era,
                      rollup_concept_id
              from (
                ${expPlusEraStats(p)}
              ) exp_w_era_stats
              ${filter||''}
              group by person_id, rollup_concept_id, era_num
                            `;
  }
  function expPlusEraStats(p) {
    return `
                  /* expPlusEraStats(${JSON.stringify(p)}) */
                  select
                          max(drug_exposure_end) over (partition by person_id, era_num) - min(drug_exposure_start_date) over (partition by person_id, era_num) as era_days,
                          first_value(days_from_latest) over (partition by person_id, era_num order by exp_num) as btn_era_gap_days,
                          min(exp_num) over (partition by person_id, era_num) from_exp,
                          max(exp_num) over (partition by person_id, era_num) to_exp,
                          first_value(drug_exposure_start_date) over (partition by person_id, era_num order by exp_num) era_start_date,
                          last_value(drug_exposure_end) over (partition by person_id, era_num order by exp_num) era_end_date,
                          first_value(drug_exposure_start_date) over (partition by person_id, era_num order by exp_num) -
                          first_value(drug_exposure_start_date) over (partition by person_id order by exp_num) as days_from_first_era,
                          exp_w_era_num.*
                  from ( ${expPlusEraNum(p)}
                  ) exp_w_era_num `;
  }
  function expPlusEraNum(p) {
    let {resultsSchema, maxgap, concept_id, person_id, 

            // ntiles, measurename,  
            // DON'T WANT TO SEND THESE FORWARD, RIGHT?
            // MESSES UP INNER exposure_rollup WITH UNNEEDED NTILES
      //
            bundle, entityName, filter} = p;
    let p2 = {resultsSchema, maxgap, concept_id, person_id, bundle, entityName, filter};
    return `
                      /* expPlusEraNums(${JSON.stringify(p2)}) */
                      select sum(case when exp_num = 1 or days_from_latest > @maxgap then 1 else 0 end)
                                  over (partition by person_id order by exp_num
                                        rows between unbounded preceding and current row)
                                    as era_num,
                            exp_plus_era_num.*
                      from (${exposure_rollup(p2, false)}
                      ) exp_plus_era_num `;
  }
  function eras(p) {
    let {resultsSchema, maxgap, concept_id, person_id, ntiles, measurename, bundle, entityName} = p;
    let sql = plainEras({resultsSchema, maxgap, concept_id, person_id, ntiles, measurename, bundle, entityName});
    let where = [];

    let ntilecol =
          (typeof ntiles === 'undefined' || typeof measurename === 'undefined')
          ? ''
          : ntileCol({ntiles, measurename, bundle, entityName}, where);

    let whereClause = '';
    if (where.length) {
      whereClause = `where ${where.join(' and ')}`;
    }
    return `
            /* eras(${JSON.stringify(p)}) */
            select ${ntilecol}
                    plain_eras.*
            from (${sql}
            ) plain_eras
            ${whereClause} `;
  }

};

