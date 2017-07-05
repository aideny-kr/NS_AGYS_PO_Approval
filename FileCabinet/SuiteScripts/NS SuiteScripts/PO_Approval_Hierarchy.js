/**
 * Module Description
 *
 * Version    Date            Author           Remarks
 * 1.00       05 Feb 2014     ldemercurio
 * 1.10		  29 Jun 2017	  chan
 * 
 */

function callPOSuitelet(action, hierarchy, nextApprover) {
	var poId = nlapiGetRecordId();
	var url = nlapiResolveURL('SUITELET', 'customscript_ag_sl_po_approval_route', 'customdeploy_1');
	url += '&poId=' + poId;
	url += '&action=' + action;
	url += '&hierarchy=' + hierarchy;
	url += '&nextApprover=' + nextApprover;
	window.open(url, '_self');
}

function beforeLoad_approvalLockRecord(type, form, request) {
	if(type == 'view') {
		form.setScript('customscript_ag_po_approval');
		
		var appHierarchyRecId = nlapiGetFieldValue('custbody_poapv_approval_hierarchy');
		nlapiLogExecution('DEBUG', 'Hierarchy record loaded', appHierarchyRecId);
		if(!isEmpty(appHierarchyRecId)) {
			var recordId = nlapiGetRecordId();
			var nextApprover = nlapiGetFieldValue('custbody_ag_po_approval_next_approver');
			var thresholdAmount = +nlapiGetFieldValue('custbody_poapv_threshold_amt');
			var budgetOwner1Threshold = nlapiLookupField('customrecord_poapv_approval_hierarchy', appHierarchyRecId, 'custrecord_poapv_owner1_threshold');
			var status = nlapiGetFieldValue('custbody_ag_po_approval_status');
			
			nlapiLogExecution('DEBUG', 'threshold amount ', thresholdAmount + ', ' + budgetOwner1Threshold);
			
			if(+budgetOwner1Threshold <= thresholdAmount) {
				// Approval is required!
				nlapiLogExecution('DEBUG', 'Threshold reached', 'Approval is required for this PO ' + recordId);
				// PO Approval Field ID approvalstatus
				/* Pending Submit - 1
				 * Pending Approval - 2
				 * Approved - 3
				 * Rejected - 4
				 */
				if(isEmpty(nextApprover)){
					
					nlapiSubmitField('purchaseorder', recordId, ['custbody_ag_po_approval_status', 'approvalstatus'], ['1', '1']);
				}
				
				if(!isEmpty(status)) {
					// status is not empty deploy buttons and lock record
					
					if(status == '1') {
						// when status is pending submit
						
						form.addButton('custpage_po_submit_approver_btn', 'Submit For Approval', 
								'callPOSuitelet('+ '1, ' + appHierarchyRecId + ')');
						
					}
					
					if(status == '2') {
						// when status is pending approval
						
						var userId = nlapiGetUser();
						var roleId = nlapiGetRole();
						
						// when status is pending approval
						form.removeButton('submitedit');
						form.removeButton('edit');
						form.removeButton('print');
						
						// Admin or Next Approver can approve 
						if(roleId == '3' || userId == nextApprover) {

							form.addButton('custpage_po_approval_btn', 'Approve', 
									'callPOSuitelet(' + 2 + ', ' + appHierarchyRecId +', ' + nextApprover +')');
							form.addButton('custpage_po_reject_btn', 'Reject', 
									'callPOSuitelet(' + 3 + ', ' + appHierarchyRecId + ')');
						}
						
					}
					
					if(status == '4') {
						// when status is reject
					}
				}
				

			}
			

		}

	}
}

function beforeSubmit_setApprovalHierarchy(type){

    try{
    	var LogTitle = 'Set PO Approval Routing';
    	nlapiLogExecution('DEBUG', LogTitle, 'Write Operation Type: ' + type);

    	if(type!='create' && type!='edit'){
    		nlapiLogExecution('DEBUG', LogTitle,'Operation Type is not Edit or Create - Exiting Script');
    		return;
    	}

    	// build an object to determine Inventory or Non-Inventory PO  
    	var subtotalObj = (function(){
    		
    		var obj = {};
    		var invItemTotal = 0;
    		var nonInvItemTotal = 0;

    		var sublistCount = nlapiGetLineItemCount('item');
    		for (var i = 1; i <= sublistCount; i += 1) {

    			var lineItemType = nlapiGetLineItemValue('item', 'itemtype', i);
    			var lineItemRate = +nlapiGetLineItemValue('item', 'amount', i);

    			if(lineItemType == 'InvtPart') {
    				invItemTotal += lineItemRate;
    			}

    			if(lineItemType == 'NonInvtPart') {
    				nonInvItemTotal += lineItemRate;
    			}
    		}

    		if(invItemTotal > 0 && nonInvItemTotal > 0) {

    			obj['Type'] = invItemTotal > nonInvItemTotal ? 'Inventory' : 'Non-Inventory';
    			obj['Inv_Subtotal'] = invItemTotal;
    			obj['NonInv-Subtotal'] = nonInvItemTotal;
    			nlapiSetFieldValue('custbody_ag_noninv_subtotal', nonInvItemTotal);
    			nlapiSetFieldValue('custbody_ag_inv_subtotal', invItemTotal);

    		} else if(invItemTotal > 0) {

    			obj['Type'] = 'Inventory';
    			obj['Inv_Subtotal'] = invItemTotal;
    			obj['NonInv-Subtotal'] = 0;
    			nlapiSetFieldValue('custbody_ag_inv_subtotal', invItemTotal);

    		} else if(nonInvItemTotal > 0) {

    			obj['Type'] = 'Non-Inventory';
    			obj['NonInv-Subtotal'] = nonInvItemTotal;
    			obj['Inv_Subtotal'] = 0;
    			nlapiSetFieldValue('custbody_ag_noninv_subtotal', nonInvItemTotal);
    		}

    		return obj;

    	})();

    	var recType = nlapiGetRecordType();
    	var recID = nlapiGetRecordId();
    	var recAppvDept = nlapiGetFieldValue('custbody_poapv_approving_cost_center');
    	var recPOtype = nlapiGetFieldValue('custbody_poapv_po_type');
    	var recPOsub = nlapiGetFieldValue('subsidiary');
    	var recPOAH = nlapiGetFieldValue('custbody_poapv_approval_hierarchy');

    	var invType = subtotalObj['Type'];

    	if (!isEmpty(recPOAH)){
    		nlapiLogExecution('DEBUG', LogTitle,'PO Approval Hierarchy is already set - Exiting Script');
    		return;
    	}

    	nlapiLogExecution('DEBUG', LogTitle, 
    		'Record Type: ' + recType + '<br>' +
    		'Record ID: ' + recID + '<br>' +
    		'Approving Cost Center: ' + recAppvDept + '<br>' +
    		'PO Type: ' + recPOtype + '<br>' +
    		'Subsidiary: ' + recPOsub);

    	if (!isEmpty(recAppvDept) && !isEmpty(recPOtype)){
		// set-up search to fetch the PO Approval Hierarchy record by Cost Center, PO Type, and Subsidiary
    		var arrFilters = new Array();
    		arrFilters[0] = new nlobjSearchFilter('custrecord_poapv_cost_center', null, 'is', recAppvDept);
    		arrFilters[1] = new nlobjSearchFilter('custrecord_poapv_po_type', null, 'is', recPOtype);
    		arrFilters[2] = new nlobjSearchFilter('custrecord_poapv_subsidiary', null, 'is', recPOsub);

    		// search filter depending on the inventory type
    		if(invType == 'Inventory') {
    			arrFilters[3] = new nlobjSearchFilter('custrecord_ag_po_category', null, 'is', '1');
    		} else if(invType == 'Non-Inventory') {
    			arrFilters[3] = new nlobjSearchFilter('custrecord_ag_po_category', null, 'is', '2');
    		}

    		var arrColumns = new Array();
    		arrColumns[0] = new nlobjSearchColumn('internalid');

    		var arrResults = nlapiSearchRecord('customrecord_poapv_approval_hierarchy', null, arrFilters, arrColumns);			
    	}

    	if (arrResults == null){ // if no results are returned, exit the script
    		nlapiLogExecution('DEBUG', LogTitle, 'Cost Center, PO Type, and Subsidiary combination does not exist');
    		nlapiSetFieldValue('custbody_poapv_approval_hierarchy', null);
    		return;
    	}

    	if (arrResults.length == 1){ // only 1 result should be returned based on Cost Center, PO Type, and Subsidiary
    		var numRecID = arrResults[0].getValue('internalid');
    		
    		nlapiSetFieldValue('custbody_poapv_approval_hierarchy', numRecID);
    		nlapiLogExecution('DEBUG', LogTitle, 'PO Approval Routing Record ID: ' + numRecID + ' | Field set on PO');
    	}

    	else{ // if more than 1 result is returned, exit the script
    		nlapiLogExecution('DEBUG', LogTitle, 'Cost Center, PO Type, and Subsidiary combination is not unique');
    		nlapiSetFieldValue('custbody_poapv_approval_hierarchy', null);
    		return;
    	}

    } catch (e){
    	if (e instanceof nlobjError) nlapiLogExecution('ERROR', 'System Error', e.getCode() + '<br>' + e.getDetails());
    	else nlapiLogExecution('ERROR', 'Unexpected Error', e.toString());
    }
}


function afterSubmit_SetThresholdAmtOnPO(type){

    try{
    	var LogTitle = 'Set Threshold Amount on PO'; 
    	nlapiLogExecution('DEBUG', LogTitle, 'Write Operation Type: ' + type);

    	if(type!='create' && type!='edit'){
    		nlapiLogExecution('DEBUG', LogTitle,'Operation Type is not Edit or Create - Exiting Script');
    		return;
    	}
    	
    	var executionContext = nlapiGetContext().getExecutionContext();
    	
    	if(executionContext != 'suitelet') {
        	var THRESHOLD_CURRENCY = nlapiGetContext().getSetting('SCRIPT','custscript_threshold_currency2');
        	var recPO = nlapiGetNewRecord();
        	var recID = nlapiGetRecordId();
        	var nonInvTotal = +nlapiGetFieldValue('custbody_ag_noninv_subtotal') || 0;
        	var invTotal = +nlapiGetFieldValue('custbody_ag_inv_subtotal') || 0;
        	var stTotal = nonInvTotal >= invTotal ? nonInvTotal : invTotal;
        	var stCurrId = recPO.getFieldValue('currency');

        	nlapiLogExecution('DEBUG', LogTitle,
        			'PO ID: ' + recID + '<br>' +
        			'Threshold Currency: ' + THRESHOLD_CURRENCY + '<br>' +
        			'PO Currency: ' + stCurrId);

        	if(stCurrId== THRESHOLD_CURRENCY){
        		nlapiSubmitField('purchaseorder',nlapiGetRecordId(),'custbody_poapv_threshold_amt',stTotal);
        		nlapiLogExecution('DEBUG', LogTitle, 'PO Threshold Amount set on PO: ' + stTotal);
        	}

        	else{
        		var stExchDt = recPO.getFieldValue('trandate');
        		var stThresholdAmt = convertForeignAmount(stExchDt,stTotal,stCurrId,THRESHOLD_CURRENCY);

        		nlapiSubmitField('purchaseorder',nlapiGetRecordId(),'custbody_poapv_threshold_amt', stThresholdAmt);
        		nlapiLogExecution('DEBUG', LogTitle, 'PO Threshold Amount set on PO: ' + stThresholdAmt);
        	}
    	}

    }

    catch (error){
    	if (error.getDetails != undefined){
    		nlapiLogExecution('ERROR', 'Process Error', error.getCode() + ': ' + error.getDetails());
    		throw error;
    	}
    	else{
    		nlapiLogExecution('ERROR', 'Unexpected Error', error.toString());
    		throw nlapiCreateError('99999', error.toString());
    	}
    }
}

function convertForeignAmount(exchdate,amount,currFrom,currTo){

	var fExchRate = nlapiExchangeRate(currFrom,currTo,exchdate);
	amount = (parseFloat(amount) * fExchRate).toFixed(2);
	nlapiLogExecution('DEBUG','Convert Foreign Amount','Converted Amount=' + amount);
	return amount;
}

function isEmpty(value){
    if (value === null) return true;
    if (value === undefined) return true;
    if (value === '') return true;
    return false;
}