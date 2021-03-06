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

package app.metatron.discovery.domain.workbench;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.rest.webmvc.RepositoryRestController;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.Assert;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.supercsv.prefs.CsvPreference;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.EntityManager;
import javax.servlet.http.HttpServletResponse;

import app.metatron.discovery.common.exception.ResourceNotFoundException;
import app.metatron.discovery.domain.audit.Audit;
import app.metatron.discovery.domain.audit.AuditRepository;
import app.metatron.discovery.domain.datasource.connection.DataConnection;
import app.metatron.discovery.domain.datasource.connection.DataConnectionRepository;
import app.metatron.discovery.domain.datasource.connection.jdbc.JdbcCSVWriter;
import app.metatron.discovery.domain.datasource.connection.jdbc.JdbcConnectionService;
import app.metatron.discovery.domain.datasource.connection.jdbc.JdbcDataConnection;
import app.metatron.discovery.domain.datasource.ingestion.jdbc.SelectQueryBuilder;
import app.metatron.discovery.domain.workbench.util.WorkbenchDataSource;
import app.metatron.discovery.domain.workbench.util.WorkbenchDataSourceUtils;
import app.metatron.discovery.util.HibernateUtils;
import app.metatron.discovery.util.HttpUtils;

@RepositoryRestController
public class QueryEditorController {

  private static Logger LOGGER = LoggerFactory.getLogger(QueryEditorController.class);

  @Autowired
  WorkbenchService workbenchService;

  @Autowired
  QueryEditorService queryEditorService;

  @Autowired
  QueryEditorRepository queryEditorRepository;

  @Autowired
  AuditRepository auditRepository;

  @Autowired
  DataConnectionRepository dataConnectionRepository;

  @Autowired
  JdbcConnectionService jdbcConnectionService;

  @Autowired
  private WorkbenchProperties workbenchProperties;

  @Autowired
  EntityManager entityManager;

  @RequestMapping(path = "/queryeditors/{id}/query/run", method = RequestMethod.POST)
  @ResponseBody
  public ResponseEntity<?> runQuery(@PathVariable("id") String id,
                               @RequestBody QueryRunRequest requestBody) {

    //1. Parameter 확인

    //Request Param 확인
    String query = StringUtils.defaultString(requestBody.getQuery());
    String webSocketId = StringUtils.defaultString(requestBody.getWebSocketId());
    String database = StringUtils.defaultString(requestBody.getDatabase());
    int numRows = requestBody.getNumRows();

    LOGGER.debug("id : {}", id);
    LOGGER.debug("query : {}", query);
    LOGGER.debug("webSocketId : {}", webSocketId);
    LOGGER.debug("database : {}", database);
    LOGGER.debug("numRows : {}", numRows);

    Assert.isTrue(!query.isEmpty(), "Parameter 'query' is empty.");
    Assert.isTrue(!webSocketId.isEmpty(), "Parameter 'webSocketId' is empty.");

    //QueryEditor Entity 확인
    QueryEditor queryEditor = queryEditorRepository.findOne(id);
    if(queryEditor == null){
      throw new ResourceNotFoundException("QueryEditor(" + id + ")");
    }

    //Connection Entity 확인
    Workbench workbench = queryEditor.getWorkbench();

    if(workbench == null){
      throw new ResourceNotFoundException("Workbench");
    }

    //Hibernate Proxy Initialize
    DataConnection dataConnection = HibernateUtils.unproxy(workbench.getDataConnection());
    if(dataConnection == null){
      throw new ResourceNotFoundException("DataConnection");
    }

    JdbcDataConnection jdbcDataConnection = null;
    if(dataConnection instanceof JdbcDataConnection){
      jdbcDataConnection = (JdbcDataConnection) dataConnection;
    } else {
      throw new ResourceNotFoundException("JdbcDataConnection");
    }

    //@ TODO 임시 테스트코드
    WorkbenchDataSource dataSourceInfo = WorkbenchDataSourceUtils.findDataSourceInfo(webSocketId);
    if(dataSourceInfo == null){
      workbenchService.createSingleDataSource(jdbcDataConnection, webSocketId);
    }

    //2. 현재 실행중인 쿼리 상태 확인
    QueryStatus queryStatus = queryEditorService.getQueryStatus(webSocketId);
    if(queryStatus != null && queryStatus == QueryStatus.RUNNING) {
      //실행중일 경우 에러 메시지 Return
      throw new WorkbenchException(WorkbenchErrorCodes.QUERY_STATUS_ERROR_CODE, "Query is Running");
    }


    //3. 쿼리 실행 서비스 호출
    List<QueryResult> queryResults = queryEditorService.getQueryResult(queryEditor, jdbcDataConnection, workbench,
            query, webSocketId, database, numRows);

    //4. Audit에 쿼리 결과 저장 (Hive Audit Hook와 충돌 방지 하기 위해 Controller 레벨에서 수행함)
    //Hive Hook에서 Update할때 버전이 안맞아 업데이트 에러방지
    entityManager.clear();
    for(QueryResult queryResult : queryResults){
      Audit.AuditStatus auditStatus;
      if(queryResult.getQueryResultStatus() == QueryResult.QueryResultStatus.SUCCESS){
        auditStatus = Audit.AuditStatus.SUCCESS;
      } else {
        auditStatus = Audit.AuditStatus.FAIL;
      }
      Audit audit = auditRepository.findOne(queryResult.getAuditId());
      audit.setStatus(auditStatus);
      audit.setElapsedTime(queryResult.getFinishDateTime().toDate().getTime() - queryResult.getStartDateTime().toDate().getTime());
      audit.setFinishTime(queryResult.getFinishDateTime());
      audit.setNumRows(queryResult.getNumRows());
      auditRepository.saveAndFlush(audit);
    }

    return ResponseEntity.ok(queryResults);
  }

  @RequestMapping(path = "/queryeditors/{id}/query/cancel", method = RequestMethod.POST,
          produces = MediaType.APPLICATION_JSON_VALUE)
  @ResponseBody
  public ResponseEntity<?> cancelQuery(@PathVariable("id") String id,
                                       @RequestBody QueryRunRequest requestBody) {

    //Result Map
    Map<String, Object> returnMap = new HashMap<>();

    //1. Parameter 확인

    //Request Param 확인
    String webSocketId = StringUtils.defaultString(requestBody.getWebSocketId());

    LOGGER.debug("id : {}", id);
    LOGGER.debug("webSocketId : {}", webSocketId);

    Assert.isTrue(!webSocketId.isEmpty(), "Parameter 'webSocketId' is empty.");

    //2. 현재 실행중인 쿼리 상태 확인
    QueryStatus queryStatus = queryEditorService.getQueryStatus(webSocketId);
    if(queryStatus == null || queryStatus != QueryStatus.RUNNING) {
      //실행중일 경우 에러 메시지 Return
      throw new WorkbenchException(WorkbenchErrorCodes.QUERY_STATUS_ERROR_CODE, "Query is Not Running");
    }

    //QueryEditor Entity 확인
    QueryEditor queryEditor = queryEditorRepository.findOne(id);
    if(queryEditor == null){
      throw new ResourceNotFoundException("QueryEditor(" + id + ")");
    }

    //Workbench Entity 확인
    Workbench workbench = queryEditor.getWorkbench();
    if(workbench == null){
      throw new ResourceNotFoundException("Workbench");
    }

    //Connection Entity 확인
    //Hibernate Proxy Initialize
    DataConnection dataConnection = HibernateUtils.unproxy(workbench.getDataConnection());
    if(dataConnection == null){
      throw new ResourceNotFoundException("DataConnection");
    }

    JdbcDataConnection jdbcDataConnection = null;
    if(dataConnection instanceof JdbcDataConnection){
      jdbcDataConnection = (JdbcDataConnection) dataConnection;
    } else {
      throw new ResourceNotFoundException("JdbcDataConnection");
    }

    queryEditorService.cancelQuery(jdbcDataConnection, webSocketId);

    return ResponseEntity.noContent().build();
  }


  @RequestMapping(path = "/queryeditors/{id}/status", method = RequestMethod.POST)
  @ResponseBody
  public ResponseEntity<?> getStatus(@PathVariable("id") String id,
                                     @RequestBody QueryRunRequest requestBody) {

    //Request Param 확인
    String webSocketId = StringUtils.defaultString(requestBody.getWebSocketId());

    LOGGER.debug("id : {}", id);
    LOGGER.debug("webSocketId : {}", webSocketId);

    Assert.isTrue(!webSocketId.isEmpty(), "Parameter 'webSocketId' is empty.");

    //QueryEditor Entity 확인
    QueryEditor queryEditor = queryEditorRepository.findOne(id);
    if(queryEditor == null){
      throw new ResourceNotFoundException("QueryEditor(" + id + ")");
    }

    //2. 현재 실행중인 쿼리 상태 확인
    QueryStatus queryStatus = queryEditorService.getQueryStatus(webSocketId);

    if(queryStatus == null){
      throw new WorkbenchException(WorkbenchErrorCodes.DATASOURCE_NOT_EXISTED, "DataSource for webSocket(" + webSocketId + ") is not existed.");
    }
    return ResponseEntity.ok(queryStatus);
  }


  @RequestMapping(path = "/queryeditors/{id}/query/download", method = RequestMethod.POST,
          consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
  public void downloadResultForm(@PathVariable("id") String id,
                                 @RequestParam Map<String, Object> requestParam,
                                 HttpServletResponse response) throws IOException {
    String query = (String) requestParam.get("query");
    String webSocketId = (String) requestParam.get("webSocketId");
    String tempTable = (String) requestParam.get("tempTable");
    String connectionId = (String) requestParam.get("connectionId");
    String fileName = (String) requestParam.get("fileName");

    //1. 현재 실행중인 쿼리 상태 확인
    QueryStatus queryStatus = queryEditorService.getQueryStatus(webSocketId);
    if(queryStatus == null){
      throw new ResourceNotFoundException("WorkbenchDataSource For WebSocket(" + webSocketId + ")");
    } else if(queryStatus == QueryStatus.RUNNING) {
      //실행중일 경우 에러 메시지 Return
      throw new WorkbenchException(WorkbenchErrorCodes.QUERY_STATUS_ERROR_CODE, "Query is Running");
    }

    if(StringUtils.isEmpty(fileName)){
      fileName = "noname";
    }

    String csvPath = workbenchProperties.getTempCSVPath();
    String csvFilePath = csvPath + File.separator + fileName + "_" + Calendar.getInstance().getTime().getTime() + ".csv";

    createCSVFile(query, webSocketId, tempTable, connectionId, fileName, csvFilePath);
    HttpUtils.downloadCSVFile(response, fileName, csvFilePath, "text/csv");
  }

  @RequestMapping(path = "/queryeditors/{id}/query/download", method = RequestMethod.POST,
          consumes = MediaType.APPLICATION_JSON_VALUE)
  @ResponseBody
  public void downloadResultJson(@PathVariable("id") String id,
                             @RequestBody Map<String, Object> requestBody,
                             HttpServletResponse response) throws IOException {
    String query = (String) requestBody.get("query");
    String webSocketId = (String) requestBody.get("webSocketId");
    String tempTable = (String) requestBody.get("tempTable");
    String connectionId = (String) requestBody.get("connectionId");
    String fileName = (String) requestBody.get("fileName");

    if(StringUtils.isEmpty(fileName)){
      fileName = "noname";
    }

    String csvPath = workbenchProperties.getTempCSVPath();
    String csvFilePath = csvPath + File.separator + fileName + "_" + Calendar.getInstance().getTime().getTime() + ".csv";

    createCSVFile(query, webSocketId, tempTable, connectionId, fileName, csvFilePath);
    HttpUtils.downloadCSVFile(response, fileName, csvFilePath, "text/csv; charset=utf-8");
  }

  private void createCSVFile(String query, String webSocketId, String tempTable,
                        String connectionId, String fileName, String csvFilePath) throws IOException{
    //Hibernate Proxy Initialize
    DataConnection dataConnection = dataConnectionRepository.findOne(connectionId);
    if(dataConnection == null){
      throw new ResourceNotFoundException("DataConnection(" + connectionId + ")");
    }

    JdbcDataConnection jdbcDataConnection;
    if(dataConnection instanceof JdbcDataConnection){
      jdbcDataConnection = (JdbcDataConnection) dataConnection;
    } else {
      throw new ResourceNotFoundException("JdbcDataConnection");
    }

    if(StringUtils.isNotEmpty(tempTable)){
      query = new SelectQueryBuilder(jdbcDataConnection)
              .allProjection()
              .query(null, null, tempTable)
              .build();
    }

    //@ TODO 임시 테스트코드
    WorkbenchDataSource dataSourceInfo = WorkbenchDataSourceUtils.findDataSourceInfo(webSocketId);
    if(dataSourceInfo == null){
      workbenchService.createSingleDataSource(jdbcDataConnection, webSocketId);
      dataSourceInfo = WorkbenchDataSourceUtils.findDataSourceInfo(webSocketId);
    }

    dataSourceInfo.setQueryStatus(QueryStatus.RUNNING);
    try{
      JdbcCSVWriter jdbcCSVWriter = new JdbcCSVWriter(new FileWriter(csvFilePath), CsvPreference.STANDARD_PREFERENCE);
      jdbcCSVWriter.setConnection(jdbcDataConnection);
      jdbcCSVWriter.setFetchSize(5000);
      jdbcCSVWriter.setMaxRow(1000000);
//      jdbcCSVWriter.setDataSourceInfo(dataSourceInfo);
      jdbcCSVWriter.setDataSource(dataSourceInfo.getSingleConnectionDataSource());
      jdbcCSVWriter.setQuery(query);
      jdbcCSVWriter.setFileName(csvFilePath);
      jdbcCSVWriter.write();
    } catch(Exception e){
      LOGGER.error(e.getMessage());
      throw new WorkbenchException(WorkbenchErrorCodes.QUERY_STATUS_ERROR_CODE, "CSV Download Failed");
    } finally {
      dataSourceInfo.setQueryStatus(QueryStatus.IDLE);
      dataSourceInfo.setCurrentStatement(null);
    }

  }

}
