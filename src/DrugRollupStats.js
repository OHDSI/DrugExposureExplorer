import React, { Component } from 'react';
import _ from 'supergroup';
var d3 = require('d3');

import {SparkBarsChart} from './components/SparkBars';

export class DrugRollupContainer extends Component {
	constructor() {
		super();
		this.state = {
			rollups: [],
			rollup: null,
		};
	}
	componentDidMount() {
		fetch('http://0.0.0.0:3000/api/DrugRollupStats')
		.then(function(response) {
			return response.json()
		}).then(function(json) {
			//console.log('parsed json', json)
			let rollups = this.dataPrep(json);
			this.setState({rollups});
		}.bind(this)).catch(function(ex) {
			console.error('parsing failed', ex)
		});
	}
	setContainerState(key, val) {
		this.setState({[key]: val});
	}
	dataPrep(json) {
		let recs = json.map(
			record => {
				let rec = Object.assign({}, record);
				rec.avgExposureDays = parseFloat(rec.avgExposureDays);
				rec.avgGapDays = parseFloat(rec.avgGapDays);
				rec.avgGapDaysPct = parseFloat(rec.avgGapDaysPct);
				rec.expCount = parseFloat(rec.expCount);
				rec.maxGapDays = parseFloat(rec.maxGapDays);
				rec.maxGapDaysPct = parseFloat(rec.maxGapDaysPct);
				rec.minGapDays = parseFloat(rec.minGapDays);
				rec.minGapDaysPct = parseFloat(rec.minGapDaysPct);
				rec.personCount = parseFloat(rec.personCount);
				return rec;
			}
		);
		let rollups = 
			_.supergroup(recs, 
				['rollupClass','rollupConceptName','gapDaysNtile']);
		return rollups;
	}
  render() {
		//console.log(this.props.children);
		var children = React.Children.map(this.props.children, 
					(child) => React.cloneElement(child, { 
						rollups: this.state.rollups, 
						rollup: this.state.rollup,
						concept: this.state.concept,
						setContainerState: this.setContainerState.bind(this),
					}));
		return (
			<div>
				this is the container
				{children}
			</div>
		);
	}
}
export class RollupList extends Component {
	render() {
		const {rollups, rollup, concept, setContainerState} = this.props;
		if (!rollup) { // show all rollups
			return (
				<div className="drugrollup">
					Drug rollups available:
					<ul>
						{rollups.map(rollup =>
							<li key={rollup.toString()}>
								<a href="#" style={{cursor:'pointer'}} 
										onClick={()=>setContainerState('rollup',rollup)}>{rollup.toString()}</a>
							</li>)}
					</ul>
				</div>
			);
		} else { // already picked a rollup
			return (
				<div>
					<h1>rollup stats</h1>
					<RollupStats 
							rollup={rollup} 
							concept={concept} 
							setContainerState={setContainerState} 
							/>
				</div>
			);
		}
	}
}

var commify = d3.format(',');

export class RollupStats extends Component {
	/*
	constructor(props) {
		super(props);
	}
	*/
	render() {
		const {rollup, concept, setContainerState} = this.props;
		if (!rollup) {
			throw new Error("shouldn't be here");
		}
		if (!concept) { // show all concepts in rollup
			let concepts = rollup.children.sortBy(d=>-d.aggregate(_.sum, 'personCount'));
			let list = concepts.map(concept => {
				return <li key={concept.toString()} >
									<a href="#" style={{cursor:'pointer'}} 
										onClick={()=>setContainerState('concept',concept)}>{concept.toString()}</a>:
									<ConceptSummary
										concept={concept}
										setContainerState={setContainerState}
									/></li>;
			});
			return (
				<div className="drugrollup">
					{rollup.toString()}
					<br/>
					<ul>{list}</ul>
				</div>
			);
		} else { // concept already chosen
			return	<div>
								{concept.toString()}:
								<ConceptSummary
									concept={concept}
									setContainerState={setContainerState}
									/>
							</div>;
		}
	}
}

export class ConceptSummary extends Component {
	render() {
		const {concept} = this.props;
		return (
			<div>
				{commify(concept.aggregate(_.sum, 'personCount'))} patients,
				{commify(concept.aggregate(_.sum, 'expCount'))} exposures,
				<SparkBarsChart
						things={concept.children}
						width={150}
						height={100} 
						valFunc={ntile=> {
							if (ntile.records.length !== 1)
								console.error('expected a single record');
							return ntile.records[0].avgGapDays;
						}}
						sortBy={ntile=>ntile.valueOf()}
						/>
			</div>
		);
	}
}
