

## Drug Utilization Visualization experiments ##

- [Description](#description)
  - [Use cases](#use-cases)
- [Installation](#installation)
- [Things to work on](#things-to-work-on)
- [Acknowledgements](#acknowledgements)

## Description

Need to write this. Hope to have a demo up soon.

### Use cases ###

Need help with this

 - in cohort definition we might say we want all exposures to x
   with a 180-day washout period or, alternatively, all first exposures
   to x with a 180-day washout period. but we seldom have a clear
   sense of how different those two cohorts will be. here we can
   see, for instance, by setting era maxgap to 180, in synpuf5%,
   half of patients with ANTIHYPERTENSIVES exposure go on to have
   another exposure after a 180-day gap and we can see the distribution
   of the actual gaps before the next exposure, and can play with
   different washout periods (well, I'm not including obs period yet),
   to (very quickly) see how it affects cohort selection

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
- next projects:
  - treatment pathways
    - sunburst
    - lifeflow/event flow
  - vocab/population navigation



## Acknowledgements

This work is funded by [The University of Colorado](http://www.ucdenver.edu), 
[Health Data Compass](http://www.ucdenver.edu/about/departments/healthdatacompass)
under the direction of [Michael Kahn](https://profiles.ucdenver.edu/display/225446),
technical guidance and support from Michael Ames and Hajar Homayouni,
with subject matter expertise and guidance from Marsha Raebel, Christina Aquilante,
and Katy Trinkley.

It is being designed and implemented by [Sigfried Gold](http://sigfried.org) for 
the benefit of Health Data Compass and the [OHDSI](http://ohdsi.org) community.

I'd like to express my great gratitude to Michael Kahn for giving me the chance to
work on this project and the creative freedom to experiment and build what
we hope will be genuinely innovative and useful tools for health data research.

Contact me (sigfried at sigfried dot org) with any technical questions.

-----------------------------------------

Copyright 2016 Sigfried Gold, 
[Licensed under the Apache License, Version 2.0](https://raw.githubusercontent.com/Sigfried/drugutil/master/LICENSE).
You may not use this file except in compliance with the License.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

