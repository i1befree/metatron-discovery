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

import { AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit } from '@angular/core';
import { Field, Rule } from '../../../../../../domain/data-preparation/dataset';
import { EditRuleComponent } from './edit-rule.component';
import { Alert } from '../../../../../../common/util/alert.util';

@Component({
  selector: 'edit-rule-drop',
  templateUrl: './edit-rule-drop.component.html'
})
export class EditRuleDropComponent extends EditRuleComponent implements OnInit, AfterViewInit, OnDestroy {
  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Private Variables
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Protected Variables
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Variables
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  public selectedFields: Field[] = [];

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Constructor
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // 생성자
  constructor(
    protected elementRef: ElementRef,
    protected injector: Injector) {
    super(elementRef, injector);
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Override Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 컴포넌트 초기 실행
   */
  public ngOnInit() {
    super.ngOnInit();
  } // function - ngOnInit

  /**
   * 화면 초기화
   */
  public ngAfterViewInit() {
    super.ngAfterViewInit();
  } // function - ngAfterViewInit

  /**
   * 컴포넌트 제거
   */
  public ngOnDestroy() {
    super.ngOnDestroy();

  } // function - ngOnDestroy

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method - API
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  /**
   * 컴포넌트의 초기 실행
   * @param {Field[]} fields
   * @param {Rule} rule
   */
  public init(fields: Field[], rule?: Rule) {
    if (rule) {
      const colVal = rule['col']['value'];
      const colList: string[] = (colVal instanceof Array) ? colVal : [colVal];
      this.selectedFields = fields.filter( item => -1 < colList.indexOf( item.name ) );
    }
    super.init(fields, rule);
    this.safelyDetectChanges();
  } // function - init

  /**
   * Rule 형식 정의 및 반환
   * @return {{command: string, col: string, ruleString: string}}
   */
  public getRuleData(): { command: string, col: string, ruleString: string } {

    if (this.selectedFields.length === 0) {
      Alert.warning(this.translateService.instant('msg.dp.alert.sel.col'));
      return;
    } else if (this.selectedFields.length === this.fields.length) { // at least one column must exist
      Alert.warning('Cannot delete all columns');
      return;
    }

    const columnsStr: string = this.selectedFields.map( item => item.name ).join(', ');

    return {
      command: 'drop',
      col: columnsStr,
      ruleString: 'drop col: ' + columnsStr
    };

  } // function - getRuleData

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Public Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  /**
   * 필드 변경
   * @param {{target: Field, isSelect: boolean, selectedList: Field[]}} data
   */
  public changeFields(data:{target:Field, isSelect:boolean, selectedList:Field[]}) {
    this.selectedFields = data.selectedList;
  } // function - changeFields

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Protected Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  | Private Method
  |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

}
