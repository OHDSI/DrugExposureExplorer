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
import React, { Component } from 'react';
import _ from 'lodash';
var d3 = require('d3');
var FixedDataTable = require('fixed-data-table');
const {Table, Column, Cell} = FixedDataTable;

const AccCell = ({rowIndex, data, col, cellProps, ...props}) => (
  <Cell {...cellProps}>
    {
      ((props.fmtAccessor && props.fmtAccessor.bind(props))
        ||props.accessor
      )(data.getObjectAt(rowIndex))
    }
  </Cell>
);
function sortByAndReturnSomething(baseList, sortBy, direction, something) {
  let list;
  if (something === 'list') { // something == 'list' or 'indexes'
    list = _.sortBy(baseList, sortBy);
    if (direction === 'DESC') {
      return list;
    }
    return list.reverse();
  }
  list = _.chain(baseList)
                .map((d,i) => [sortBy(d), i])
                .sortBy(d=>d[0])
                .value();
  if (direction === 'DESC') {
    return list.map(d=>d[1]);
  }
  return list.reverse().map(d=>d[1]);
}
export default class FixedDataTableSortFilt extends Component {
  constructor(props) {
    super(props);
    const {data, coldefs, tableProps} = this.props;
    let colSortDirs = _.chain(coldefs)
                        .map((d,i)=>[this.colKey(d,i),d.defaultSortDir])
                        .filter(d=>d[1])
                        .fromPairs()
                        .value();
    let sortCol = _.first(coldefs, d=>d.defaultSortDir);
    let sortDir = sortCol.defaultSortDir;
    this._dataList = new DumbStore(
      sortByAndReturnSomething(data, sortCol.accessor, sortDir, 'list')
    );
    this._defaultSortIndexes = _.range(data.length);

    let filteredDataList = new DataListWrapper(this._defaultSortIndexes, this._dataList);
    let sortedDataList = new DataListWrapper(this._defaultSortIndexes, this._dataList);

    const searchColIdxs = 
      coldefs
        .map((d,i) => [d,i])
        .filter(d => d[0].searchable)
        .map(d=>d[1]);
    const filterFunc = 
      (row, searchText) =>
        // searchText already lowercase
        _.some(searchColIdxs.map(
          idx => coldefs[idx].accessor(row).toLowerCase()
                    .indexOf(searchText) !== -1
        ));

    this.state = {
      filteredDataList,
      sortedDataList,
      colSortDirs,
      filterFunc,
      searchColIdxs,
    };

    this._onFilterChange = this._onFilterChange.bind(this);
    this._onSortChange = this._onSortChange.bind(this);
  }
  colKey(coldef, i) {
    if (typeof coldef.key !== 'undefined') return coldef.key;
    if (typeof coldef.id !== 'undefined') return coldef.id;
    return `col_${i}`;
  }
  render() {
    const {data, coldefs, tableProps, 
      tableHeadFunc, _onRowClick,
      _key} = this.props;
    let {searchCaption} = this.props;
    var {filteredDataList, searchColIdxs } = this.state;
    var {sortedDataList, colSortDirs} = this.state;
    var sortFiltDataList = filteredDataList;
    if (sortedDataList._indexMap) {
      if (filteredDataList._indexMap) {
        sortFiltDataList = new DataListWrapper(
          _.intersection( // preserves order I believe
            sortedDataList._indexMap,
            filteredDataList._indexMap),
          this._dataList);
      } else {
        sortFiltDataList = sortedDataList;
      }
    }

    var columns = coldefs.map((d,i) => {
      let header = d.header || <Cell>{d.title}</Cell>;
      if (d.sortable) {
        header =
            <SortHeaderCell
              coldef={d}
              onSortChange={this._onSortChange}
              sortDir={colSortDirs[this.colKey(d,i)]}>
              {d.title}
            </SortHeaderCell>;
      }
      let cell = d.cell || 
        <AccCell {...d} data={sortFiltDataList}/>;
      let id = d.id || i;
      return (
        <Column
          key={this.colKey(d,i)}
          columnKey={this.colKey(d,i)}
          header={header}
          cell={cell}
          {...d.colProps}
        />
      );
    });
    searchCaption = searchCaption ||
      `Search ${
        searchColIdxs.map(
          (idx) => {
            let d = coldefs[idx];
            return d.name || d.title || this.colKey(d,idx);
          }).join(', ')}`;
    
    return (
      <div key={_key}>
        <input
          onChange={this._onFilterChange}
          placeholder={searchCaption}
        />{' '}
        {tableHeadFunc ? tableHeadFunc(sortFiltDataList) : ''}
        <Table
          rowsCount={sortFiltDataList.getSize()}
          onRowClick={((evt,idx,obj)=>_onRowClick(evt,idx,obj,sortFiltDataList))||(()=>{})}
          {...tableProps}>
          {columns}
        </Table>
      </div>
    );
  }

  _onSortChange(coldef, columnKey, sortDir) {
    var sortIndexes = sortByAndReturnSomething(this._dataList.arr, coldef.accessor, sortDir, 'indexes');
    this.setState({
      sortedDataList: new DataListWrapper(sortIndexes, this._dataList),
      colSortDirs: {
        [columnKey]: sortDir,
      },
    });
  }
  _onFilterChange(e) {
    const {filterFunc} = this.state;
    if (!e.target.value) {
      this.setState({
        filteredDataList: this._dataList,
      });
    }

    var filterBy = e.target.value.toLowerCase();
    var size = this._dataList.getSize();;
    var filteredIndexes = [];
    for (var index = 0; index < size; index++) {
      var row = this._dataList.getObjectAt(index);
      if (filterFunc(row, filterBy)) {
        filteredIndexes.push(index);
      }
    }

    this.setState({
      filteredDataList: new DataListWrapper(filteredIndexes, this._dataList),
    });
  }
  /*
  render() {
    const {rollup} = this.props;
    return (
      <span style={{marginLeft: 10}}>
        Concepts: {rollup.children.length}
      </span>
    );
  }
  */
}
/*
const StringCell = ({rowIndex, data, col, ...props}) => (
  <Cell {...props}>
    {data.getObjectAt(rowIndex).toString()}
  </Cell>
);
const SGCell = ({func, rowIndex, data, col, ...props}) => (
  <Cell {...props}>
    {func(data.getObjectAt(rowIndex))}
  </Cell>
);
const TextCell = ({rowIndex, data, col, ...props}) => (
  <Cell {...props}>
    {data.getObjectAt(rowIndex)[col]}
  </Cell>
);
*/

class DumbStore {
  constructor(arr){
    this.arr = arr;
    this.size = arr.length;
    this._cache = [];
  }

  permute(indexes) {
    this.arr = d3.permute(this.arr, indexes);
  }
  getObjectAt(/*number*/ index) /*?object*/ {
    if (index < 0 || index > this.size){
      return undefined;
    }
    if (this._cache[index] === undefined) {
      this._cache[index] = this.arr[index];
    }
    return this._cache[index];
  }

  /**
  * Populates the entire cache with data.
  * Use with Caution! Behaves slowly for large sizes
  * ex. 100,000 rows
  */
  getAll() {
    if (this._cache.length < this.size) {
      for (var i = 0; i < this.size; i++) {
        this.getObjectAt(i);
      }
    }
    return this._cache.slice();
  }

  getSize() {
    return this.size;
  }
}
class DataListWrapper {
  constructor(indexMap, data) {
    this._indexMap = indexMap;
    this._data = data;
  }

  getSize() {
    return this._indexMap.length;
  }

  getObjectAt(index) {
    return this._data.getObjectAt(
      this._indexMap[index],
    );
  }
}
var SortTypes = {
  ASC: 'ASC',
  DESC: 'DESC',
};

function reverseSortDirection(sortDir) {
  return sortDir === SortTypes.DESC ? SortTypes.ASC : SortTypes.DESC;
}

class SortHeaderCell extends React.Component {
  constructor(props) {
    super(props);

    this._onSortChange = this._onSortChange.bind(this);
  }

  render() {
    var {sortDir, children, onSortChange, coldef, ...props} = this.props;
    return (
      <Cell {...props}>
        <a onClick={this._onSortChange}>
          {children} {sortDir ? (sortDir === SortTypes.DESC ? '↓' : '↑') : ''}
        </a>
      </Cell>
    );
  }

  _onSortChange(e) {
    e.preventDefault();

    if (this.props.onSortChange) {
      this.props.onSortChange(
        this.props.coldef,
        this.props.columnKey,
        this.props.sortDir ?
          reverseSortDirection(this.props.sortDir) :
          SortTypes.DESC
      );
    }
  }
}
/*
class SortExample extends React.Component {


  render() {
    var {sortedDataList, colSortDirs} = this.state;
    return (
      <Table
        rowHeight={50}
        rowsCount={sortedDataList.getSize()}
        headerHeight={50}
        width={1000}
        height={500}
        {...this.props}>
        <Column
          columnKey="id"
          header={
            <SortHeaderCell
              onSortChange={this._onSortChange}
              sortDir={colSortDirs.id}>
              id
            </SortHeaderCell>
          }
          cell={<TextCell data={sortedDataList} />}
          width={100}
        />
        <Column
          columnKey="firstName"
          header={
            <SortHeaderCell
              onSortChange={this._onSortChange}
              sortDir={colSortDirs.firstName}>
              First Name
            </SortHeaderCell>
          }
          cell={<TextCell data={sortedDataList} />}
          width={200}
        />
        <Column
          columnKey="lastName"
          header={
            <SortHeaderCell
              onSortChange={this._onSortChange}
              sortDir={colSortDirs.lastName}>
              Last Name
            </SortHeaderCell>
          }
          cell={<TextCell data={sortedDataList} />}
          width={200}
        />
        <Column
          columnKey="city"
          header={
            <SortHeaderCell
              onSortChange={this._onSortChange}
              sortDir={colSortDirs.city}>
              City
            </SortHeaderCell>
          }
          cell={<TextCell data={sortedDataList} />}
          width={200}
        />
        <Column
          columnKey="companyName"
          header={
            <SortHeaderCell
              onSortChange={this._onSortChange}
              sortDir={colSortDirs.companyName}>
              Company Name
            </SortHeaderCell>
          }
          cell={<TextCell data={sortedDataList} />}
          width={200}
        />
      </Table>
    );
  }
}
*/
