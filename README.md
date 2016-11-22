

## Drug Utilization Visualization experiments ##

- [Description](#description)
  - [Use cases](#use-cases)
- [Installation](#installation)
- [Things to work on](#things-to-work-on)
- [Acknowledgements](#acknowledgements)

## Description

Need to write this

### Use cases ###

Need help with this

 - thinking about washout periods, set era maxgap to washout period
   and see how many eras people have. For instance, in synpuf5%,
   half of patients with ANTIHYPERTENSIVES exposure go on to have
   another exposure after 180-day gap. does that mean anything?

## Installation

Need to write this

## Things to work on

- stagger overlapping exposures
- load more patients
  - provide means to select patients by useful attributes
  - put patients in datatable, improve formatting
  - show collapsed view of patient with just timeline
- distributions
  - cumulative distribution function
  - add KDE, maybe do brushing on the KDE
  - Carsten's idea: break up gaps by exposure duration blocks
  - full height on hover
  - legend text for charts
  - hover over exposure duration
    - tooltip for all recs with same duration
    - filter gaps (and maybe all other distributions
      to records tied to hover region
  - gap duration
    - brush gap region to select subsets of patients
      and show sample patients accordingly
  - fix y axis
  - make height consistent
  - fix choppy gap distributions (or are those meaningful?)
- more distribution charts for overall drug characteristics:
  - single exposure days
  - single gap days (with overlap)
  - total exposure days
  - total gap days (with overlap)
  - gap days between exposures
  - gap days between eras
- connect to other data
  - overall patient timelines for individual patients
  - conditions, concomitant medications, measurements, demographics, etc.
- data composition
  - get help validating
  - what to do with not enough recs for ntiles?



## Acknowledgements

(need permission to acknowledge)
