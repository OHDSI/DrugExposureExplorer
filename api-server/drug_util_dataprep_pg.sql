/*
Copyright 2016 Sigfried Gold

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/


drop table if exists omop5_synpuf_5pcnt_results.drug_rollup;
create table omop5_synpuf_5pcnt_results.drug_rollup (
  drug_concept_id integer,
  rollup_class character varying(255),
  rollup_concept_id integer,
  primary key (drug_concept_id, rollup_class, rollup_concept_id)
);
create index drdcidx on omop5_synpuf_5pcnt_results.drug_rollup (drug_concept_id);


insert into omop5_synpuf_5pcnt_results.drug_rollup 
select  distinct 
        de.drug_concept_id, 
        'ATC 3rd' as rollup_class,
        rc.concept_id as rollup_concept_id 
from omop5_synpuf_5pcnt.drug_exposure de
inner join omop5_synpuf_5pcnt.concept_ancestor ca on de.drug_concept_id = ca.descendant_concept_id 
inner join omop5_synpuf_5pcnt.concept rc on ca.ancestor_concept_id = rc.concept_id
where rc.vocabulary_id = 'ATC' 
  and rc.concept_class_id = 'ATC 3rd' 
  and rc.invalid_reason is null 
  ;

insert into omop5_synpuf_5pcnt_results.drug_rollup 
select  distinct 
        de.drug_concept_id, 
        'ATC 2nd' as rollup_class,
        rc.concept_id as rollup_concept_id 
from omop5_synpuf_5pcnt.drug_exposure de
inner join omop5_synpuf_5pcnt.concept_ancestor ca on de.drug_concept_id = ca.descendant_concept_id 
inner join omop5_synpuf_5pcnt.concept rc on ca.ancestor_concept_id = rc.concept_id
where rc.vocabulary_id = 'ATC' 
  and rc.concept_class_id = 'ATC 2nd' 
  and rc.invalid_reason is null 
  ;

insert into omop5_synpuf_5pcnt_results.drug_rollup 
select  distinct 
        de.drug_concept_id, 
        'Ingredient' as rollup_class,
        rc.concept_id as rollup_concept_id 
from omop5_synpuf_5pcnt.drug_exposure de
inner join omop5_synpuf_5pcnt.concept_ancestor ca on de.drug_concept_id = ca.descendant_concept_id 
inner join omop5_synpuf_5pcnt.concept rc on ca.ancestor_concept_id = rc.concept_id
where rc.vocabulary_id = 'RxNorm' 
  and rc.concept_class_id = 'Ingredient' 
  and rc.invalid_reason is null 
  ;

drop table if exists omop5_synpuf_5pcnt_results.drug_exposure_rollup_pre;
create table omop5_synpuf_5pcnt_results.drug_exposure_rollup_pre as ( -- could be temporary table
  select  dr.*, 
          person_id, 
          drug_exposure_start_date,
          drug_exposure_start_date + days_supply as drug_exposure_end,
          drug_exposure_id,
          days_supply,
          quantity,
          refills,
          provider_id,
          drug_type_concept_id
  from omop5_synpuf_5pcnt.drug_exposure de
  join omop5_synpuf_5pcnt_results.drug_rollup dr on de.drug_concept_id = dr.drug_concept_id
  --where de.days_supply is not null --or de.drug_exposure_end_date is not null
  where de.days_supply > 0
  -- TEMPORARY!!!!  --and person_id <= 100
);
create index on omop5_synpuf_5pcnt_results.drug_exposure_rollup_pre (person_id, rollup_class, rollup_concept_id, drug_exposure_start_date, drug_exposure_id);

drop table if exists omop5_synpuf_5pcnt_results.drug_exposure_rollup cascade;
create table omop5_synpuf_5pcnt_results.drug_exposure_rollup as (
    select
        row_number() 
          over (partition by person_id, rollup_class, rollup_concept_id 
                order by drug_exposure_start_date, drug_exposure_id) 
          as exp_num,

        max(drug_exposure_end)
          over (partition by person_id, rollup_class, rollup_concept_id
                order by drug_exposure_start_date, drug_exposure_id 
                rows between unbounded preceding and 1 preceding) 
          as latest_exposure_date,

        drug_exposure_start_date -
          max(drug_exposure_end)
          over (partition by person_id, rollup_class, rollup_concept_id
                order by drug_exposure_start_date, drug_exposure_id 
                rows between unbounded preceding and 1 preceding)
          as days_from_latest,
        derp.*
    from omop5_synpuf_5pcnt_results.drug_exposure_rollup_pre derp
);

alter table omop5_synpuf_5pcnt_results.drug_exposure_rollup add primary key (person_id,rollup_class,rollup_concept_id,exp_num);
create index dersupidx on omop5_synpuf_5pcnt_results.drug_exposure_rollup (rollup_concept_id, days_supply);
create index dergapidx on omop5_synpuf_5pcnt_results.drug_exposure_rollup (rollup_concept_id, days_from_latest);
--create index derpeopleidx on omop5_synpuf_5pcnt_results.drug_exposure_rollup (person_id,rollup_concept_id,exp_num desc);

drop table if exists omop5_synpuf_5pcnt_results.drug_by_person_stats cascade;
create table omop5_synpuf_5pcnt_results.drug_by_person_stats as (
    select  der.person_id,
            der.rollup_class,
            der.rollup_concept_id,
            min(der.drug_exposure_start_date) as first_exp_start,
            max(der.latest_exposure_date) as latest_exp_end, 
            max(der.drug_exposure_end) as last_exp_end, 
            max(der.drug_exposure_end) - min(der.drug_exposure_start_date) as exposure_days_first_to_last,
            sum(der.days_supply) as total_days_supply,
            sum(case when der.days_from_latest > 0 
                     then der.days_from_latest else 0 end) as gap_days,
            sum(case when der.days_from_latest < 0 
                     then
                        case when -der.days_from_latest > der.days_supply 
                             then der.days_supply
                             else -der.days_from_latest
                        end
                     else 0 
                end) as overlap_days,
            count(distinct der.drug_exposure_id) as exp_count,
            --count(distinct der.drug_exposure_id) = max(der.exp_num) as exp_count_sanity_check,
            count(distinct der.drug_concept_id) as drug_concept_count,
            count(distinct der.provider_id) as provider_count,
            sum(der.quantity) as total_quantity,
            sum(der.refills) as sum_of_refills -- probably double/triple counts
    from omop5_synpuf_5pcnt_results.drug_exposure_rollup der
    group by der.person_id, der.rollup_class, der.rollup_concept_id
  );

alter table omop5_synpuf_5pcnt_results.drug_by_person_stats_pre add primary key (person_id,rollup_class,rollup_concept_id);
create index drug_person_stats_pre_idx on omop5_synpuf_5pcnt_results.drug_by_person_stats_pre(rollup_class, rollup_concept_id);
create index drug_person_stats_pre_idx2 on omop5_synpuf_5pcnt_results.drug_by_person_stats_pre(rollup_concept_id, exp_count);

-- maybe just do this as needed?
create materialized view omop5_synpuf_5pcnt_results.drug_by_person_stats_ntile as (
    select
            ntile(10) over (partition by rollup_class, rollup_concept_id order by gap_days) gap_days_ntile,
            ntile(10) over (partition by rollup_class, rollup_concept_id order by overlap_days) overlap_days_ntile,
            ntile(10) over (partition by rollup_class, rollup_concept_id order by gap_days / exposure_days_first_to_last) gap_days_pct_ntile,
            ntile(10) over (partition by rollup_class, rollup_concept_id order by overlap_days / exposure_days_first_to_last) overlap_days_pct_ntile,
            dps.*
    from omop5_synpuf_5pcnt_results.drug_by_person_stats_pre dps
  );
create index drug_person_stats_idx on omop5_synpuf_5pcnt_results.drug_by_person_stats(rollup_class, rollup_concept_id);
  
drop table if exists omop5_synpuf_5pcnt_results.drug_rollup_stats;
create table omop5_synpuf_5pcnt_results.drug_rollup_stats as (
select rollup_class, rollup_concept_id, c.concept_name as rollup_concept_name, --gap_days_ntile,
        min(gap_days) as min_gap_days,
        max(gap_days) as max_gap_days,
        avg(gap_days) as avg_gap_days,
        sum(exp_count) as exp_count,
        count(distinct person_id) as person_count,
        avg(exposure_days_first_to_last) as avg_exposure_days,
        min(1.0 * gap_days / exposure_days_first_to_last) as min_gap_days_pct,
        max(1.0 * gap_days / exposure_days_first_to_last) as max_gap_days_pct,
        avg(1.0 * gap_days / exposure_days_first_to_last) as avg_gap_days_pct
from omop5_synpuf_5pcnt_results.drug_by_person_stats  dbps
join omop5_synpuf_5pcnt.concept c on dbps.rollup_concept_id = c.concept_id
group by 1,2,3--,4
);
alter table omop5_synpuf_5pcnt_results.drug_rollup_stats add primary key (rollup_class, rollup_concept_id);

drop type era_rec cascade;
create type era_rec as (person_id int, era_num int8, exposures int8, 
                          era_days int, total_days_supply int8, 
                          gap_days int, from_exp int8,
                          to_exp int8, era_start_date date, era_end_date date,
                          days_from_first_era int);
-- max gap days, concept_id
create or replace function Eras(int, int) returns setof era_rec as
'
select
        person_id,
        era_num,
        count(*) as exposures,
        max(drug_exposure_end) - min(drug_exposure_start_date) as era_days,
        sum(days_supply) as total_days_supply,
        min(gap_days) as gap_days, -- these should be the same on every rec in era
        min(from_exp) as from_exp,
        min(to_exp) as to_exp,
        min(era_start_date) as era_start_date,
        min(era_end_date) as era_end_date,
        min(days_from_first_era) as days_from_first_era
from (
  select  first_value(days_from_latest) over (partition by person_id, era_num order by exp_num) gap_days,
          min(exp_num) over (partition by person_id, era_num) from_exp,
          max(exp_num) over (partition by person_id, era_num) to_exp,
          first_value(drug_exposure_start_date) over (partition by person_id, era_num order by exp_num) era_start_date,
          last_value(drug_exposure_end) over (partition by person_id, era_num order by exp_num) era_end_date,
          first_value(drug_exposure_start_date) over (partition by person_id, era_num order by exp_num) -
          first_value(drug_exposure_start_date) over (partition by person_id order by exp_num) as days_from_first_era,
          eras.*
  from (
    select sum(case when exp_num = 1 or days_from_latest > $1 then 1 else 0 end)
                over (partition by person_id order by exp_num
                      rows between unbounded preceding and current row)
                  as era_num,
          der.*
    from omop5_synpuf_5pcnt_results.drug_exposure_rollup der
    where rollup_concept_id = $2
  ) eras
) eras2
group by person_id, era_num
'
language 'sql';


----->>>-------THIS IS UNFINISHED, BUT WHAT I WAS WORKING ON
             --BEFORE SWITCHING FOCUS
-- same as above but with all exposures combined into single era for each patient:
drop type single_era_rec cascade;
create type single_era_rec as (person_id int, exposures int8, exp_count int8,
                          first_exp_start date, last_exp_end date,
                          total_days int, total_days_supply int8, 
                          gap_days int8, overlap_days int8,
                          drug_concept_count int8,
                          provider_count int8,
                          total_quantity numeric,
                          sum_of_refills int8);
create or replace function SingleEra(int) returns setof single_era_rec as
'
select
        person_id,
        count(*) as exposures,
        count(distinct der.drug_exposure_id) as exp_count, -- should be same as above?
        min(drug_exposure_start_date) as first_exp_start,
        max(latest_exposure_date) as last_exp_end, 
        max(drug_exposure_end) - min(drug_exposure_start_date) as total_days,
        sum(days_supply) as total_days_supply,
        sum(case when days_from_latest > 0 
                  then days_from_latest else 0 end) as gap_days,
        sum(case when days_from_latest < 0 
                  then
                    case when -days_from_latest > days_supply 
                          then days_supply
                          else -days_from_latest
                    end
                  else 0 
            end) as overlap_days,
        count(distinct der.drug_concept_id) as drug_concept_count,
        count(distinct der.provider_id) as provider_count,
        sum(der.quantity) as total_quantity,
        sum(der.refills) as sum_of_refills -- probably double/triple counts
from omop5_synpuf_5pcnt_results.drug_exposure_rollup der
where rollup_concept_id = $1
group by person_id
'
language 'sql';
----------------------<<<<-----------------


-- day_supply by exp_num
select count(*), exp_num, supply_ntile,
      min(days_supply), max(days_supply), avg(days_supply),
      min(days_from_latest), max(days_from_latest), avg(days_from_latest)
from (select  der.*,
              ntile(100) over (order by days_supply) supply_ntile
        from drug_exposure_rollup der
        where rollup_concept_id = 21601853
      ) dern
group by 2,3 order by 2,3;


create type expgroups as (count int8, exp_or_gap_num int8, ntile int, min int, max int, avg numeric);
-- params: ntiles, concept_id
create or replace function DaySupplyByExpnum(int, int) returns setof expgroups as
'
select count(exp_num), exp_numg, ntile,
      min(days_supply), max(days_supply), avg(days_supply)
from (
  select expntile.*, dern.*
  from
      (
      select generate_series as exp_numg, b.ntile
       from generate_series(1,
            (select max(exp_num) from omop5_synpuf_5pcnt_results.drug_exposure_rollup der
              where rollup_concept_id = $2)) 
      join (select generate_series as ntile from generate_series(1,$1)) b on 1=1
     ) expntile
    left outer join (select  der.*,
                      ntile($1) over (partition by exp_num order by days_supply) supply_ntile
                    from omop5_synpuf_5pcnt_results.drug_exposure_rollup der
                    where rollup_concept_id = $2
                    ) dern on expntile.ntile = supply_ntile and expntile.exp_numg = dern.exp_num
    ) withextra
group by 2,3 order by 2,3
'
language 'sql';

create or replace function DaySupplyDist(int, int) returns setof expgroups as
'
select count(*), null, supply_ntile,
      min(days_supply), max(days_supply), avg(days_supply)
from (select  der.*,
              ntile($1) over (partition by exp_num order by days_supply) supply_ntile
        from omop5_synpuf_5pcnt_results.drug_exposure_rollup der
        where rollup_concept_id = $2
      ) dern
group by 2,3 order by 2,3
'
language 'sql';

-- params: ntiles, concept_id, maxgapdays
create or replace function DaySupplyByEranum(int, int, int) returns setof expgroups as
'
select count(*), era_num, supply_ntile,
      min(total_days_supply)::integer, max(total_days_supply)::integer, avg(total_days_supply)
from (select  eras.*,
              ntile($1) over (partition by era_num order by total_days_supply) supply_ntile
        from omop5_synpuf_5pcnt_results.eras($3, $2) eras
      ) erasn
group by 2,3 order by 2,3
'
language 'sql';

-- gaps
select count(*), exp_num - 1 as gap_num, gap_ntile,
      min(days_supply), max(days_supply), avg(days_supply),
      min(days_from_latest), max(days_from_latest), avg(days_from_latest)
from (select  der.*,
              ntile(100) over (order by days_from_latest) gap_ntile
        from drug_exposure_rollup der
        where rollup_concept_id = 21601853
        and exp_num > 1
      ) dern
group by 2,3 order by 2,3;

create or replace function GapsByGapnum(int, int) returns setof expgroups as
'
select count(*), exp_num, gap_ntile,
      min(days_from_latest), max(days_from_latest), avg(days_from_latest)
from (select  der.*,
              ntile($1) over (partition by exp_num order by days_from_latest) gap_ntile
        from omop5_synpuf_5pcnt_results.drug_exposure_rollup der
        where rollup_concept_id = $2 and exp_num > 1
      ) dern
group by 2,3
having count(*) > 0
order by 2,3
'
language 'sql';

create or replace function GapsByEranum(int, int, int) returns setof expgroups as
'
select count(*), era_num, gap_ntile,
      min(gap_days)::integer, max(gap_days)::integer, avg(gap_days)
from (select  eras.*,
              ntile($1) over (partition by era_num order by gap_days) gap_ntile
        from omop5_synpuf_5pcnt_results.eras($3, $2) eras
        where era_num > 1
      ) erasn
group by 2,3 order by 2,3
'
language 'sql';

select * from omop5_synpuf_5pcnt_results.DaySupplyByExpnum(4,21602054) ds
where ds.exp_or_gap_num = 3;

select * from omop5_synpuf_5pcnt_results.GapsByGapnum(4,21602054) gp
where gp.exp_or_gap_num = 3;

select * from omop5_synpuf_5pcnt_results.DaySupplyByExpnum(13,21602054) ds
left outer join omop5_synpuf_5pcnt_results.GapsByGapnum(13,21602054) gp 
  on ds.exp_or_gap_num = gp.exp_or_gap_num and ds.ntile = gp.ntile
  --and gp.exp_or_gap_num <= 3
where ds.exp_or_gap_num = 3; 

select distinct person_id, exp_num
    from omop5_synpuf_5pcnt_results.drug_exposure_rollup ds
    where ds.rollup_concept_id = 21602054
    order by exp_num desc
    limit 10

select count(*), exp_num, supply_ntile,
      min(days_supply), max(days_supply), avg(days_supply)
from (
    select  ds.exp_num, ds.days_supply,
            gp.exp_num, gp.days_from_latest,
            ntile(3) over (order by ds.days_supply) supply_ntile,
            ntile(3) over (order by gp.days_from_latest) gap_ntile
    from omop5_synpuf_5pcnt_results.drug_exposure_rollup ds
    left join omop5_synpuf_5pcnt_results.drug_exposure_rollup gp
          on ds.exp_num = gp.exp_num - 1
          and ds.person_id = gp.person_id
    where ds.rollup_concept_id = 21602054
      and gp.rollup_concept_id = 21602054
      and ds.person_id in (38975, 69313)
      and gp.person_id in (38975, 69313)
      and ds.exp_num < 7
      and gp.exp_num < 7
    order by 1, 5, 6
) dern
group by 2,3 order by 2,3


select exp_num, supply_ntile, avg(days_supply), count(*)
from (
    select  person_id, ds.exp_num, ds.days_supply,
            ntile(1) over (partition by ds.exp_num order by ds.days_supply) supply_ntile
    from omop5_synpuf_5pcnt_results.drug_exposure_rollup ds
    where ds.rollup_concept_id = 21602054
      --and ds.person_id in (38975, 69313)
      and ds.exp_num < 7
) ds
group by 1,2
order by 1,2;


select exp_num, gap_ntile, avg(days_from_latest), count(*)
from (
    select  person_id, gp.exp_num, gp.days_from_latest,
            ntile(1) over (partition by gp.exp_num order by gp.days_from_latest) gap_ntile
    from omop5_synpuf_5pcnt_results.drug_exposure_rollup gp
    where gp.rollup_concept_id = 21602054
      --and ds.person_id in (38975, 69313)
      and gp.exp_num < 7
) gp
group by 1,2
order by 1,2;

/*

select                                      ^
        rollup_class, nt to reference the column "de.drug_exposure_id".
        c.concept_name as drug,
        exp_num,
        avg(days_from_latest) avg_gap,
        avg(days_supply) avg_days_supply,
        avg(refills) avg_refills
from drug_exposure_rollup der
join omop5_synpuf_5pcnt.concept c on der.rollup_concept_id=c.concept_id
join omop5_synpuf_5pcnt.drug_exposure de on der.drug_exposure_id = de.drug_exposure_id
group by 1,2,3
order by 1,2,3;

*/

/*
create view omop5_synpuf_5pcnt_results.drug_exp_era_atc3_30 as (
  select sum(case when exp_num = 1 or days_from_latest > 30 then 1 else 0 end)
            over (partition by person_id, rollup_class, rollup_concept_id
                  order by exp_num
                  rows between unbounded preceding and current row)
              as era_num,
          dec.*
  from omop5_synpuf_5pcnt_results.drug_exposure_context dec
)


create table omop5_synpuf_5pcnt_results.atc3_30 as (
    select 
        person_id, rollup_class, rollup_concept_id, exp_num, 
        latest_exposure_date, days_from_latest_exposure,
        max(latest_exposure_date
        --dense_rank() over (partition by person_id, atc_concept_id
        drug_exposure_start_date,
        drug_exposure_end_date, exp_end_by_days_supply,  
        redundant_end_dates,
        drug_exposure_id, atc3_concept_id
    from omop5_synpuf_5pcnt_results.drug_exposure_context dec
    join (
        select person_id, rollup_class, rollup_concept_id, exp_num
        from omop5_synpuf_5pcnt_results.drug_exposure_context
        where rollup_class = 'ATC 3rd'
          and (exp_num = 1 or days_from_latest > 30)
    ) erastart on dec.person_id=erastart.person_id,
                  dec.rollup_concept_id=erastart.rollup_concept_id
                  dec.exp_num<=eraend.exp_num
);
*/



/*

-- following updates will probably only work on postgres
update omop5_synpuf_5pcnt_results.drug_exposure_extra dec
set latest_exposure_date = latest,
    days_from_latest_exposure = days_from_latest
from (
    select  drug_exposure_id,
            atc3_concept_name,
            atc3_concept_id,
            lag(latest_exposure_including_this) 
             over (partition by person_id, atc3_concept_name, atc3_concept_id
                   order by exp_num) as latest,
            drug_exposure_start_date -
              lag(latest_exposure_including_this) over (partition by 
                person_id, atc3_concept_name, atc3_concept_id order by exp_num) 
              as days_from_latest
            -- sql server: datediff(day, dee.drug_exposure_start_date, latest_exposure_date) as days_from_latest
    from omop5_synpuf_5pcnt_results.drug_exposure_extra
) deelag
where dee.drug_exposure_id = deelag.drug_exposure_id
  and dee.atc3_concept_name = deelag.atc3_concept_name
  and dee.atc3_concept_id = deelag.atc3_concept_id

create table omop5_synpuf_5pcnt_results.atc3_lookup
--with (location = user_db, distribution = hash(drug_concept_id))
as (
    select distinct
            dids.drug_concept_id, 
            dc.concept_name drug_concept_name, dc.concept_class_id drug_concept_class,
            atclink.atc3_concept_name, atclink.atc3_concept_id
    from (select distinct drug_concept_id from omop5_synpuf_5pcnt.drug_exposure) dids
    join omop5_synpuf_5pcnt.concept dc on dids.drug_concept_id = dc.concept_id
                                                and dc.invalid_reason is null
    left outer join (
        select  drug.concept_id as drug_concept_id, 
                drug.concept_name as drug_concept_name,
                atc3.concept_id as atc3_concept_id, 
                atc3.concept_name as atc3_concept_name 
        from (  select concept_id, concept_name 
                from omop5_synpuf_5pcnt.concept 
                where standard_concept = 'S' 
                  and domain_id = 'Drug' 
                  and invalid_reason is null 
        ) drug 
        inner join omop5_synpuf_5pcnt.concept_ancestor ca on drug.concept_id = ca.descendant_concept_id 
        inner join (select concept_id, concept_name 
                    from omop5_synpuf_5pcnt.concept 
                    where vocabulary_id = 'ATC' 
                      and concept_class_id = 'ATC 3rd' 
                      and invalid_reason is null 
        ) atc3 on ca.ancestor_concept_id = atc3.concept_id
    ) atclink on dids.drug_concept_id = atclink.drug_concept_id
);


create table omop5_synpuf_5pcnt_results.drug_exposure_stats_w_class
--with (location = user_db, distribution = hash(drug_concept_id))
as (
    select  de.drug_concept_id
            ,cde.concept_name drug_name
            ,cde.concept_class_id drug_concept_class
            ,cdt.concept_name drug_type_name
            ,count(*) exposures
            ,count(distinct person_id) patients
            ,sum(cast(refills as bigint)) refills
            ,sum(cast(quantity as bigint)) quantity
            ,sum(cast(days_supply as bigint)) days_supply
            ,count(distinct cast(person_id as varchar) + cast(provider_id as varchar)) pt_provider_count
    from omop5_synpuf_5pcnt.drug_exposure de
    join omop5_synpuf_5pcnt.concept cde on de.drug_concept_id = cde.concept_id and cde.invalid_reason is null
    join omop5_synpuf_5pcnt.concept cdt on de.drug_type_concept_id = cdt.concept_id
    group by drug_concept_id
             ,cde.concept_name
             ,cde.concept_class_id
             ,cdt.concept_name
);
*/
