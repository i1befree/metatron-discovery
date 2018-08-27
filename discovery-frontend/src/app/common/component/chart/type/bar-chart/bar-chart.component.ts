/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Created by Dolkkok on 2017. 7. 18..
 */

import { AfterViewInit, Component, ElementRef, EventEmitter, Injector, OnDestroy, OnInit, Output } from '@angular/core';
import { BaseChart } from '../../base-chart';
import { BaseOption } from '../../option/base-option';
import {
  BarMarkType,
  ChartType,
  DataZoomRangeType,
  Position,
  SeriesType,
  ShelveFieldType,
  ShelveType,
  SymbolType,
  UIChartDataLabelDisplayType
} from '../../option/define/common';
import { OptionGenerator } from '../../option/util/option-generator';
import { Pivot } from '../../../../../domain/workbook/configurations/pivot';
import * as _ from 'lodash';
import { UIOption } from '../../option/ui-option';
import { DataZoomType } from '../../option/define/datazoom';

@Component({
  selector: 'bar-chart',
  templateUrl: 'bar-chart.component.html'
})
export class BarChartComponent extends BaseChart implements OnInit, OnDestroy, AfterViewInit {

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Private Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // 기존 선반 정보 (병렬 / 중첩에따라서 변경되지않는 선반값)
  private originPivot: Pivot;
  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Protected Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // 변경된 UI 옵션을 UI로 전송
  @Output()
  public histogramUpdate = new EventEmitter();

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Constructor
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // 생성자
  constructor(
    protected elementRef: ElementRef,
    protected injector: Injector ) {

    super(elementRef, injector);
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Override Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // Init
  public ngOnInit() {

    // Init
    super.ngOnInit();
  }

  // Destory
  public ngOnDestroy() {

    // Destory
    super.ngOnDestroy();
  }

  // After View Init
  public ngAfterViewInit(): void {
    super.ngAfterViewInit();
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 선반정보를 기반으로 차트를 그릴수 있는지 여부를 체크
   * - 반드시 각 차트에서 Override
   */
  public isValid(pivot: Pivot): boolean {
    return ((this.getFieldTypeCount(pivot, ShelveType.COLUMNS, ShelveFieldType.DIMENSION) + this.getFieldTypeCount(pivot, ShelveType.COLUMNS, ShelveFieldType.TIMESTAMP)) > 0)
      && (this.getFieldTypeCount(pivot, ShelveType.AGGREGATIONS, ShelveFieldType.MEASURE) > 0 || this.getFieldTypeCount(pivot, ShelveType.AGGREGATIONS, ShelveFieldType.CALCULATED) > 0)
      && (this.getFieldTypeCount(pivot, ShelveType.COLUMNS, ShelveFieldType.MEASURE) == 0 && this.getFieldTypeCount(pivot, ShelveType.COLUMNS, ShelveFieldType.CALCULATED) == 0)
      && (this.getFieldTypeCount(pivot, ShelveType.ROWS, ShelveFieldType.MEASURE) == 0 && this.getFieldTypeCount(pivot, ShelveType.ROWS, ShelveFieldType.CALCULATED) == 0);
  }

  /**
   * bar차트에서만 쓰이는 uiOption설정
   * @param isKeepRange
   */
  public draw(isKeepRange?: boolean): void {

    // uiOption에 중첩일때의 최소 / 최대값 설정
    this.uiOption = this.setStackMinMaxValue();

    // 기존 선반값 설정
    this.originPivot = _.cloneDeep(this.pivot);

    // 바차트의 중첩 / 병렬에 따른 shelve 정보 변경
    this.pivot = this.changeShelveData(this.pivot);

    // 교차선반의 dimension값을 행으로 이동
    this.pivot = this.moveToAggregationFieldInfo(this.pivot);

    // 변경된 pivot정보로 fieldInfo, fieldOriginInfo 설정
    this.setFieldInfo();

    super.draw(isKeepRange);

    // 기존 선반값으로 치환
    this.pivot = _.cloneDeep(this.originPivot);

    // control차트의 바차트 업데이트 설정 (uiOptionUpdated로 하는경우 무한루프 발생)
    this.histogramUpdate.emit(this.uiOption);
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Protected Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 차트의 기본 옵션을 생성한다.
   * - 각 차트에서 Override
   */
  protected initOption(): BaseOption {
    return {
      type: ChartType.BAR,
      grid: [OptionGenerator.Grid.verticalMode(10, 0, 0, 10, false, true, false)],
      xAxis: [OptionGenerator.Axis.categoryAxis(Position.MIDDLE, null, false, true, true, true)],
      yAxis: [OptionGenerator.Axis.valueAxis(Position.MIDDLE, null, false, false, true, true, true)],
      legend: OptionGenerator.Legend.custom(false, false, Position.LEFT, SymbolType.CIRCLE, '100%', 20, 5),
      dataZoom: [OptionGenerator.DataZoom.horizontalDataZoom(), OptionGenerator.DataZoom.horizontalInsideDataZoom()],
      tooltip: OptionGenerator.Tooltip.itemTooltip(),
      toolbox: OptionGenerator.Toolbox.hiddenToolbox(),
      brush: OptionGenerator.Brush.selectBrush(),
      series: []
    };
  }

  /**
   * 차트별 시리즈 추가정보
   * - 반드시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertSeriesData(): BaseOption {

    // 시리즈 설정
    this.chartOption.series = this.data.columns.map((column) => {

      // // pivot rows 설정
      // const seriesName: string = column.name;
      // const rowNameList = _.split(seriesName, CHART_STRING_DELIMITER);
      // if (rowNameList.length > 1) {
      //   // 측정값 이름은 제외
      //   rows.push(_.join(_.dropRight(rowNameList), CHART_STRING_DELIMITER));
      // }

      // series의 data값이 0인경우 => null로 치환 (중첩시 log scale 적용에러때문)
      let dataList = [];
      for (let item of column.value) {
        if (item == 0) {
          item = null;
        }
        dataList.push(item);
      }
      column.value = dataList;

      // 시리즈 생성
      return {
        type: SeriesType.BAR,
        name: column.name,
        data: column.value,
        uiData: column,
        originData: _.cloneDeep(column.value),
        itemStyle: OptionGenerator.ItemStyle.auto(),
        label: OptionGenerator.LabelStyle.defaultLabelStyle(false, Position.TOP)
      };
    });

    return this.chartOption;
  }

  /**
   * 바차트의 series값으로 설정되는 부분
   */
  protected additionalSeries(): BaseOption {

    // 병렬 / 중첩에 따른 수치값 라벨 위치 재조정
    //this.chartOption = this.setValueLabelPosition();

    return this.chartOption;
  }

  /**
   * 바차트의 dataZoom
   */
  protected additionalDataZoom(): BaseOption {

    // 저장정보 존재 여부에 따라 미니맵 범위 자동 지정
    if (!_.isUndefined(this.uiOption.chartZooms)
      && (!_.isUndefined(this.uiOption.size) && this.uiOption.limitCheck) || (this.uiOption.chartZooms && _.isUndefined(this.uiOption.chartZooms[0].start))) {

      // Limit이 지정된 경우
      if( !_.isUndefined(this.uiOption.size) && this.uiOption.limitCheck ) {
        this.convertDataZoomRangeByType(
          this.chartOption,
          DataZoomRangeType.COUNT,
          0,
          this.uiOption.size
        );
      }
      // limit이 지정되지않은 경우
      else {
        this.convertDataZoomAutoRange(
          this.chartOption,
          20,
          500,
          10,
          this.existTimeField
        );
      }
    }

    return this.chartOption;
  }

  /**
   * 바차트의 DataZoom(미니맵) 활성화 범위 영역 자동 변경
   * @param option
   * @param count
   * @param limit
   * @param percent
   * @param isTime
   * @param idx
   * @returns {BaseOption}
   */
  protected convertDataZoomAutoRange(option: BaseOption, count: number, limit: number, percent: number, isTime: boolean, idx?: number): BaseOption {

    if (_.isUndefined(option.dataZoom)) return option;

    // 시리즈
    const series = option.series;
    // 변경하려는 DataZoom index - 따로 지정하지 않으면 0으로 설정
    const dataZoomIdx = _.isUndefined(idx) ? 0 : idx;
    // 축 단위 개수
    let colCount = !_.isUndefined(option.xAxis[0].data) ? option.xAxis[0].data.length : option.yAxis[0].data.length;

    // 종료지정 설정 (상위 n개)
    let startValue = 0;
    let endValue = count - 1;
    const isStackMode = _.eq(series[0].type, SeriesType.BAR) && !_.isUndefined(series[0].stack);
    const seriesLength = series.length;

    // bar 차트는 데이터 개수에 시리즈 개수를 곱해야 함
    // 시간 데이터는 제외
    if (!isTime) {
      colCount = isStackMode ? colCount : colCount * seriesLength;
    }
    // 기준 개수가 넘어갈 경우 경우는 n% 로 범위 변경
    if (_.gt(colCount, limit)) {
      // 전체 데이터의 10%인덱스
      endValue = seriesLength >= 20 ? 0 : Math.floor((colCount) * (percent / 100)) - 1;
    }

    // bar 차트는 시리즈 내의 개수만큼 등분
    endValue = Math.floor(endValue / seriesLength);

    // x축 개수에 따라 종료지점 설정
    endValue = _.eq(colCount, 1) ? 0 : _.eq(endValue, 0) ? 1 : endValue;

    // 시간 축이 존재한다면 확대범위를 마지막 축 기준으로 설정
    if (isTime) {
      startValue = colCount - _.cloneDeep(endValue);
      endValue = colCount - 1;
    }

    option.dataZoom[dataZoomIdx].startValue = startValue;
    option.dataZoom[dataZoomIdx].endValue = endValue;
    delete option.dataZoom[dataZoomIdx].start;
    delete option.dataZoom[dataZoomIdx].end;

    // inside datazoom 이 존재한다면 range값 동기화
    option.dataZoom.map((obj) => {
      if (_.eq(obj.type, DataZoomType.INSIDE)) {
        obj.startValue = startValue;
        obj.endValue = endValue;
        delete obj.start;
        delete obj.end;
      }
    });

    return option;
  }

  /**
   * 셀렉션 이벤트를 등록한다.
   * - 필요시 각 차트에서 Override
   */
  protected selection(): void {

    // 기존 선반값 설정
    this.originPivot = _.cloneDeep(this.pivot);

    // 교차선반의 dimension값을 행으로 이동
    this.pivot = this.moveToAggregationFieldInfo(this.pivot);

    this.addChartSelectEventListener();
    this.addChartMultiSelectEventListener();
    this.addLegendSelectEventListener();

    // 기존 선반값으로 치환
    this.pivot = _.cloneDeep(this.originPivot);
  }

  /**
   * dataLabel, tooltip 중첩에 따라서 설정
   * @returns {UIOption}
   */
  protected setDataLabel(): UIOption {

    if (!this.uiOption['mark'] || !this.pivot || !this.pivot.aggregations || !this.pivot.rows) return this.uiOption;

    // 시리즈관련 리스트 제거
    const spliceSeriesTypeList = ((seriesTypeList, dataLabel: any): any => {

      const previewFl = !!dataLabel.previewList;

      // displayTypes를 찾는 index
      let index: number;
      for (const item of seriesTypeList) {
        index = dataLabel.displayTypes.indexOf(item);

        if (-1 !== index) {
          // 라벨에서 제거
          dataLabel.displayTypes[index] = null;

          // previewList가 있는경우
          if (previewFl) {
            // 미리보기리스트에서 제거
            _.remove(dataLabel.previewList, {value: item});
          }
        }
      }
      return dataLabel;
    });

    // 병렬이거나 멀티 시리즈가 아닌경우
    if (BarMarkType.MULTIPLE == this.uiOption['mark'] || (this.pivot.aggregations.length < 2 && this.pivot.rows.length < 1)) {

      // 조건을 만족시 제거될 series타입 리스트
      const seriesTypeList = [UIChartDataLabelDisplayType.SERIES_NAME, UIChartDataLabelDisplayType.SERIES_VALUE, UIChartDataLabelDisplayType.SERIES_PERCENT];

      // 데이터라벨에서 series관련 설정제거
      if (this.uiOption.dataLabel && this.uiOption.dataLabel.displayTypes) this.uiOption.dataLabel = spliceSeriesTypeList(seriesTypeList, this.uiOption.dataLabel);

      // 툴팁의 series관련 설정제거
      if (this.uiOption.toolTip && this.uiOption.toolTip.displayTypes) this.uiOption.toolTip = spliceSeriesTypeList(seriesTypeList, this.uiOption.toolTip);
    }

    return this.uiOption;
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Private Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 데이터 라벨 위치 설정
   */
  // private setValueLabelPosition(): BaseOption {
  //
  //   const series = this.chartOption.series;
  //
  //   // 차트 표현 방향
  //   const orient = _.eq(this.chartOption.xAxis[0].type, AxisType.CATEGORY) ? Orient.VERTICAL : Orient.HORIZONTAL;
  //
  //   // 차트 표현 방향
  //   _.each(series, (obj) => {
  //     // 스택/병렬 모드별 구분
  //     if (!_.isUndefined(obj.stack)) {
  //       obj.label.normal = _.extend({}, obj.label.normal, OptionGenerator.LabelStyle.stackBarLabelStyle(orient, obj.label.normal.show, this.chartOption.type).normal);
  //     } else {
  //       obj.label.normal = _.extend({}, obj.label.normal, OptionGenerator.LabelStyle.multipleBarLabelStyle(orient, obj.label.normal.show).normal);
  //     }
  //   });
  //
  //   return this.chartOption;
  // }

  /**
   * 바차트의 shelve 변경 병렬일때 => 교차선반의 dimension을 행으로 이동 => 범례 같은 데이터 설정때문에
   */
  private changeShelveData(shelve: any): any {

    // mark가 없는경우 return
    if (!this.uiOption['mark']) return shelve;

    // 행값이 없는경우 return
    if (shelve.rows && shelve.rows.length == 0) return shelve;

    // 중첩일때
    if (BarMarkType.STACKED === this.uiOption['mark']) {

      // 교차선반에 있는 dimension을 행선반으로 이동
      for (let num = shelve.aggregations.length; num--;) {

        let item = shelve.aggregations[num];

        // dimension이면
        if (item.type === String(ShelveFieldType.DIMENSION)) {

          // 교차선반에서 제거
          shelve.aggregations.splice(num, 1);

          // 행선반에 추가
          shelve.rows.push(item);
        }
      }

    }
    // 병렬일떄
    else {

      // 교차선반에 있는 dimension을 행선반으로 이동
      for (let num = shelve.aggregations.length; num--;) {

        let item = shelve.aggregations[num];

        // dimension이면
        if (item.type === String(ShelveFieldType.DIMENSION)) {

          // 행선반에서 제거
          shelve.rows.splice(num, 1);

          // 교차선반에 추가
          shelve.aggregations.push(item);
        }
      }
    }

    return shelve;
  }

  /**
   * uiOption의 중첩시 최소 / 최대값 설정
   */
  private setStackMinMaxValue(): UIOption {
    const series = _.cloneDeep(this.data.columns);

    // 중첩 최소 / 최대값 초기화
    delete this.uiOption.stackedMinValue;
    delete this.uiOption.stackedMaxvalue;

    // stack이거나 음수값이 있는경우 stack의 min / max value 설정하기
    if ((series && this.uiOption['mark'] == BarMarkType.STACKED && series.length > 1) ||
         this.data.info.minValue < 0) {

      this.uiOption.stackedMinValue = 0;

      for (let num = series[0].value.length; num--;) {
        let maxValue = 0;
        let minValue = 0;
        let minArray = [];

        // series의 num에 해당하는 value값을 더하기
        for(const item of series) {
          if (item.value) {
            minArray.push(item.value[num]);
            maxValue += item.value[num];
          }
        }

        // 음수값이 있는경우 정수값을 더하지 않는다
        if (_.min(minArray) < 0) {
          minValue = _.sum(_.remove(minArray, (data) => {return data < 0}));

        } else {
          minValue = _.sum(minArray);
        }

        // 음수값이 있는경우 Minvalue 설정
        if (this.data.info.minValue < 0) {
          this.uiOption.stackedMinValue = this.uiOption.stackedMinValue > minValue ? minValue : this.uiOption.stackedMinValue;
        }
        // Maxvalue 설정
        this.uiOption.stackedMaxvalue = _.isUndefined(this.uiOption.stackedMaxvalue) || this.uiOption.stackedMaxvalue < maxValue? maxValue : this.uiOption.stackedMaxvalue;
      }
    }

    return this.uiOption;
  }

  /**
   * 병렬일때 fieldInfo값의 교차선반으로 이동된 dimension값을 행으로 이동
   * @param shelve
   * @returns {any}
   */
  private moveToAggregationFieldInfo(shelve: any): any {

    // fieldInfo 값을 교차선반의 교차의 dimension값을 행으로변경 -> 색상설정 오류때문
    for (let num = shelve.aggregations.length; num--;) {

      const item = shelve.aggregations[num];

      // dimension값의경우
      if (ShelveFieldType.DIMENSION === item.type) {

        // 교차에서 제거
        shelve.aggregations.splice(num, 1);
        // 행으로 이동
        shelve.rows.push(item);
      }
    }

    return shelve;
  }

}
