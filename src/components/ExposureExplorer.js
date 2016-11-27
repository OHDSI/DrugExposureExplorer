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
const DEBUG = true;
import React, { Component } from 'react';
import { Button, Panel, Modal, Checkbox, 
          OverlayTrigger, Tooltip,
          FormGroup, Radio } from 'react-bootstrap';

import _ from 'supergroup';
var d3 = require('d3');
//var d3tip = require('d3-tip');
if (DEBUG) window.d3 = d3;
import * as util from '../utils';
import DataTable from './FixedDataTableSortFilt';
import {DistSeriesContainer} from './DistCharts';

var commify = d3.format(',');

export class ExposureExplorer extends Component {
  constructor(props) {
    super(props);
    //this.dataList = props.rollup.children;
    //this._dataList = new DumbStore(props.rollup.children);
    this.state = {
      showModal: false,
      concept: null,
			settings: {},
    };
  }
  closeModal() {
    this.setState({ showModal: false });
  }
  openModal() {
    this.setState({ showModal: true });
  }
	componentWillReceiveProps(nextProps) {
		const {concept} = nextProps;
		if (concept) {
			this.openModal();
		} else {
			this.closeModal();
		}
	}
	controlSettings(settings) {
		if (!_.eq(settings, this.state.settings)) {
			this.setState({settings});
		}
	}
  render() {
		const {concept, concept_id} = this.props;
		const {showModal} = this.state;
		let controls = '', content = '';
		if (showModal) {
			controls = <ExplorerControls 
										sendSettings={this.controlSettings.bind(this)}
									/>;
			if (this.state.settings.bundle) { // check if settings are set yet
				content = <Content 
										concept={concept}
										concept_id={concept_id}
										{...this.state.settings}
									/>;
			}
		}
		return (
        <Modal bsSize="lg"
            show={this.state.showModal} 
            onHide={this.closeModal.bind(this)}
            >
          <Modal.Header closeButton>
            <Modal.Title>{concept && concept.toString()}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
						{controls}
						{content}
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.closeModal.bind(this)}>Close</Button>
          </Modal.Footer>
        </Modal>
		);
	}
}
export class ExplorerControls extends Component {
  constructor(props) {
    super(props);
    this.state = {
			maxgap: 30,
			bundle: 'era',
    };
  }
	componentDidMount() {
		const {sendSettings} = this.props;
		sendSettings(this.state);
	}
	shouldComponentUpdate(nextProps, nextState) {
		if (!_.eq(nextState, this.state)) {
			console.log('ExplorerControl new state', nextState);
			return true;
		}
		return false;
	}
	componentDidUpdate() {
		// because of above, should only be here if state actually changed
		const {sendSettings} = this.props;
		sendSettings(this.state);
	}
	setSettings(kv) {
		let state = _.merge(this.state, kv);
		this.setState(state);
	}
  render() {
		const {maxgap, bundle} = this.state;
		return (
			<div>
				<label>Exposure bundling:&nbsp;&nbsp;&nbsp;
						<Radio inline 
							checked={bundle==='era'}
							value={'era'}
							onChange={(e)=>this.setSettings.bind(this)({bundle:e.currentTarget.value})}
						>
							Era
						</Radio>
						{' '}
						<Radio inline
							checked={bundle==='exp'}
							value={'exp'}
							onChange={(e)=>this.setSettings.bind(this)({bundle:e.currentTarget.value})}
						>
							Plain Exposure
						</Radio>
						{' '}
						<Radio inline
							title="blah blah blah"
							disabled={true}
							checked={bundle==='single'}
							value={'single'}
							onChange={(e)=>this.setSettings.bind(this)({bundle:e.currentTarget.value})}
						>
							Single Era per Patient
						</Radio>
				</label>
				<label>Combine exposures to era with gap of no more than
					&nbsp;
					<input type="number" value={this.state.maxgap}
						placeholder="Max gap days"
						onChange={evt=>{
							this.setState({maxgap:evt.target.value})
						}} />
				</label>
			</div>
		);
	}
}
class Content extends Component {
  render() {
    const {concept, concept_id, width, bundle, maxgap} = this.props;
    return (<div ref='container' className="concept-detail">
              <SampleTimelinesContainer
                  width={width}
                  bundle={bundle}
                  maxgap={maxgap}
                  concept={concept}
                  concept_id={concept_id} />
              <DistSeriesContainer 
                  concept={concept}
                  concept_id={concept_id} 
									bundle={bundle}
                  maxgap={maxgap}
              />
            </div>);
  }
}
export class SampleTimelinesContainer extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      frequentUsers: null,
      howmany: 2,
    };
  }
  componentDidMount() {
    const {concept_id, bundle} = this.props;
    const {howmany} = this.state;
    let params = {
          howmany,
          concept_id,
					bundle,
    };
    util.cachedPostJsonFetch(
      'http://localhost:3000/api/People/frequentUsersPost',
      params)
    .then(function(json) {
      this.setState({frequentUsers:json});
    }.bind(this))
  }
  render() {
    const {concept, concept_id, width, bundle, maxgap} = this.props;
    const {frequentUsers} = this.state;
    if (frequentUsers) {
      let timelines = frequentUsers.map(person => {
        let personId = person.person_id;
        return <TimelineContainer   key={personId}
                                    width={width}
                                    concept={concept}
                                    concept_id={concept_id}
                                    bundle={bundle}
                                    maxgap={maxgap}
                                    personId={personId} />
      })
      return <div className="timelines">{timelines}</div>;
    } else {
      return <div className="waiting">Waiting for sample timeline data...</div>;
    }
  }
}
export class TimelineContainer extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      eras: [],
      exposures: [],
      fetchingExposures: false,
      fetchingEras: false,
    };
  }
  componentDidMount() {
    const {bundle, maxgap} = this.props;
    this.fetchEras(bundle, maxgap);
    this.fetchExposures();
  }
  componentWillReceiveProps(nextProps) {
    const {bundle, maxgap} = nextProps;
    this.fetchEras(bundle, maxgap);
    this.fetchExposures();
  }
  fetchExposures() {
    const {personId, concept_id, concept} = this.props;
    this.setState({fetchingExposures:true});
    let params = { concept_id:concept_id,
                   personid: personId };
    util.cachedPostJsonFetch(
      'http://localhost:3000/api/drug_exposure_rollups/postCall',
      params)
    .then(function(json) {
      this.setState({exposures:json, fetchingExposures:false});
    }.bind(this))
  }
  fetchEras(bundle, maxgap) {
    if (bundle === 'exp') {
      this.setState({eras:[]});
      return;
    }
    const {personId, concept_id, concept} = this.props;
    maxgap = parseInt(maxgap, 10);
    if (isNaN(maxgap)) return;
    this.setState({fetchingEras:true})
    let params = { maxgap,
                   concept_id:concept_id,
                   personid: personId };
    util.cachedPostJsonFetch(
      'http://localhost:3000/api/eras/postCall', params)
    .then(function(json) {
      this.setState({eras:json, fetchingEras:false});
    }.bind(this))
  }
  render() {
    const {exposures, eras, fetchingExposures, fetchingEras} = this.state;
    const {bundle, width, concept, personId} = this.props;
    if( fetchingExposures || fetchingEras ) {
      return (
        <div className="waiting">
          {fetchingExposures ? `Fetching exposures for ${personId} / ${concept.toString()}` : ''}
          {fetchingEras ? `Fetching eras for ${personId} / ${concept.toString()}` : ''}
        </div>);
    } else if (eras.length || (bundle==='exp' && exposures.length)) {
      return <Timeline exposures={exposures} eras={eras} 
                width={width} 
                concept={concept} personId={personId}/>;
    }
    return <div>Waiting for something to happen</div>;
  }
}
export class Timeline extends Component {
  constructor(props) {
    super(props);
    this.state = { 
			descriptionOpen: false,
    };
  }
  componentDidMount() {
    const {eras, exposures, concept, personId} = this.props;
    let lastday;
    if (eras && eras.length) {
      lastday = _.last(eras).days_from_first_era +
                _.last(eras).era_days;
    } else if (exposures && exposures.length) {
      lastday = _.last(exposures).days_from_first +
                _.last(exposures).days_supply;
    } else {
      throw new Error("why?");
    }
    const height = 40;
    let div = this.refs.timelinediv;
    const css = window.getComputedStyle(div, null);
    const width = div.clientWidth - parseFloat(css.paddingLeft)
                                  - parseFloat(css.paddingRight);
    let lo = new util.SvgLayout(
          width, height,
          { top: { margin: { size: 2}, },
            bottom: { margin: { size: 20}, },
            left: { margin: { size: 5}, },
            right: { margin: { size: 5}, },
          });
    let x = d3.scaleLinear()
              .range([0, lo.chartWidth()])
              .domain([0, lastday]);
    let xAxis = d3.axisBottom()
                .scale(x)
                //.tickFormat(this.chartProp.format)
                //.ticks(this.chartProp.ticks)
                //.orient(this.zone());
    /*
    let tip = d3tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(evt) {
        let era = eras[evt.target.attributes.getNamedItem('data-eranum').value];
        return "<strong>Frequency:</strong> <span style='color:red'>" + JSON.stringify(era,null,2) + "</span>";
      })
    */

    let drugList = _.chain(exposures)
                      .map(d=>d.drug_name)
                      .uniq()
                      .sort()
                      .value();
    const seeThroughColors = d3.schemeCategory20
            .map(d => {
              let c = d3.color(d);
              c.opacity = 0.4;
              return c;
            });
    let drugColors = d3.scaleOrdinal()
                        .range(seeThroughColors)
                        .domain(drugList);
    this.setState({
      height,
      lo, x, xAxis, lastday, drugList, drugColors,
    });
  }
  componentDidUpdate() {
    let node = this.refs.timelinediv;
    const {height, lo, x, xAxis} = this.state;
    d3.select(node).select('svg>g.axis').call(xAxis);
    //d3.select(node).select('svg').call(tip);
  }
  render() {
    const {exposures, eras, concept, personId} = this.props;
    const {height, lo, x, xAxis, lastday, drugList, drugColors} = this.state;
    if (!lo) 
      return (<div ref="timelinediv" className="timeline">
                timeline not ready
              </div>);

    //return <pre>{JSON.stringify(eras, null, 2)}</pre>;
    let exposureBars = exposures.map((exposure,i) => {
      const exposurett = (
        <Tooltip id="tooltip-exposure">
          <pre>{JSON.stringify(exposure,null,2)}</pre>
        </Tooltip>
      );
      return (
              <OverlayTrigger 
                  key={i}
                  placement="bottom" overlay={exposurett}>
                <rect  className="exposure"
                    data-expnum={i}
                    x={x(exposure.days_from_first)} 
                    width={x(exposure.days_supply)}
                    y={lo.zone('top') + lo.chartHeight() * .35}
                    height={lo.chartHeight() * .3}
                    fill={drugColors(exposure.drug_name)}
                    />
              </OverlayTrigger>);
    });
    let eraBars = eras.map((era,i) => {
      const eratt = (
        <Tooltip id="tooltip-era">
          Era {era.era_num} combines {era.exposures} exposures
          with {era.total_days_supply} total days supply
          over {era.era_days} days in era.
        </Tooltip>
      );
          //<pre>{JSON.stringify(era,null,2)}</pre>
      return (
              <OverlayTrigger 
                  key={i}
                  placement="bottom" overlay={eratt}>
                <rect  className="era"
                    data-eranum={i}
                    x={x(era.days_from_first_era)} 
                    width={x(era.era_days)}
                    y={lo.zone('top')}
                    height={lo.chartHeight()}
                    />
              </OverlayTrigger>);
    });
    let drugLegend = drugList.map(drug=>{
      return <Highlightable 
                key={drug}
                textContent={drug}
                styles={{backgroundColor:drugColors(drug)}}
              />;
    });
    let exposuresDesc = 
      <div>
        <strong>{exposures.length} exposures:</strong> {' '}
        {lastday} <span title="first day of exposure to last">days observation</span>, {' '}
        {_.sum(exposures.map(d=>d.days_supply))} total days supply, {' '}
        {_.sum( exposures
                  .map(d => d.days_from_latest)
                  .filter(d => d > 0)
          )} gap days between exposures, {' '}
        {_.sum( exposures
                  .map(d => -d.days_from_latest)
                  .filter(d => d > 0)
          )} days of exposure overlap, {' '}
        <span title="Medication Possession Ratio">MPR</span>: {' '}
        { Math.round(
            100 * _.sum(exposures.map(d=>d.days_supply)) / lastday)
        }%. <br/>
        Specific drugs: {drugLegend}
      </div>;
    let erasDesc = '';
    if (eras.length) {
      erasDesc = 
        <div>
          <strong>{eras.length} eras:</strong> {' '}
          {_.sum(eras.map(e=>e.era_days))} days in eras, {' '}
          {_.sum(eras.map(e=>e.gap_days))} gap days between eras, {' '}
          {_.sum( exposures
                  .map(d => d.days_from_latest)
                  .filter(d => d > 0)
          ) - _.sum(eras.map(e=>e.gap_days))} gap days within exposures, {' '}
          <span title="Medication Possession Ratio">MPR</span> {' '}
          ignoring days between eras: {' '}
          { Math.round(
              100 * _.sum(exposures.map(d=>d.days_supply)) / 
                    _.sum(eras.map(e=>e.era_days)))
          }%. {' '}
        </div>;
    }
    return (<div ref="timelinediv" className="timeline">
							<Button onClick={ ()=> this.setState({ descriptionOpen: !this.state.descriptionOpen })}>
                Person {personId}
							</Button>
							<Panel className="description" collapsible 
											expanded={this.state.descriptionOpen}>
                {exposuresDesc}
                {erasDesc}
              </Panel>
              <svg 
                    width={lo.w()} 
                    height={lo.h()}>
                <g className="axis"
                    transform={
                      `translate(${lo.zone('left')},${lo.h() - lo.zone('bottom')})`
                    } />
                <g className="timeline"
                    transform={
                      `translate(${lo.zone('left')},${lo.zone('top')})`
                    } />
                {eraBars}
                {exposureBars}
              </svg>
            </div>);
  }
}
export class Highlightable extends Component {
  render() {
    const {textContent, htmlContent,
            styles, triggerFunc, payload,
            listenFunc} = this.props;
                //onMouseOver={()=>triggerFunc(payload)}
    return <span style={styles}
            >
              {textContent}
            </span>;
  }
}
