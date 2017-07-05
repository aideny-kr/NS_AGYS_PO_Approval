/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       03 Jul 2017     aidenyi
 *
 */

/**
 * @param {nlobjRequest} request Request object
 * @param {nlobjResponse} response Response object
 * @returns {Void} Any output is written via response object
 */
function suitelet(req, res){
	nlapiLogExecution('DEBUG', 'Suitelet', 'Called');
	
	/**
	 * action 
	 * 1 = submit for approval
	 * 2 = approve
	 * 3 = reject
	 */
	
	var actionParam = req.getParameter('action');
	var poIdParam = req.getParameter('poId');
	var hierarchyIdParam = req.getParameter('hierarchy');
	
	var hierarchyRec = nlapiLoadRecord('customrecord_poapv_approval_hierarchy', hierarchyIdParam);
	var poRec = nlapiLoadRecord('purchaseorder', poIdParam);
	
	if(actionParam == 1) {
		poRec.setFieldValue('custbody_ag_po_approval_status', '2');
		poRec.setFieldValue('custbody_ag_po_approval_next_approver', hierarchyRec.getFieldValue('custrecord_poapv_owner1'));
		
	} 
	
	else if(actionParam == 2) {
		var currentApprover = req.getParameter('nextApprover');
		
		nlapiLogExecution('DEBUG', 'Current Approver', currentApprover);
		
		/**
		 * PO Category
		 * 1 - inventory
		 * 2 - non-inventory
		 */
		
		var poCategory = hierarchyRec.getFieldValue('custrecord_ag_po_category');
		var threshold = poRec.getFieldValue('custbody_poapv_threshold_amt');
		var nextApprover;
		
		if(poCategory == 1) {
			// inventory PO Approver - No CFO action
			nextApprover = getNextApprover(threshold, currentApprover, hierarchyRec, true);
		} 
		else{
			// CFO must approve Non-Inventory
			nextApprover = getNextApprover(threshold, currentApprover, hierarchyRec, false);
		}
		
		nlapiLogExecution('DEBUG', 'Next Approver', nextApprover);
		
		if(nextApprover == 'Approved') {
			poRec.setFieldValue('custbody_ag_po_approval_status', '3');
			poRec.setFieldValue('approvalstatus', '2');
		} else if(nextApprover == ''){
			nlapiLogExecution('DEBUG', 'Something is off', nextApprover);
		} else {
			poRec.setFieldValue('custbody_ag_po_approval_next_approver', nextApprover);
		}
	} else if(actionParam == 3) {
		poRec.setFieldValue('custbody_ag_po_approval_status', '4');
	}
	
	// submit Purchase Order 
	nlapiSubmitRecord(poRec);
	
	nlapiSetRedirectURL('RECORD','purchaseorder',poIdParam);
	
}

function getNextApprover(threshold, currentApprover, hierRec, inventory) {
	var threshold = parseFloat(threshold);
	var currCFO = hierRec.getFieldValue('custrecord_poapv_cfo');
	var currCEO = hierRec.getFieldValue('custrecord_poapv_ceo');
	var currCtrl = hierRec.getFieldValue('custrecord_poapv_controller');
	var currAsstCtrl = hierRec.getFieldValue('custrecord_popav_asst_ctrl');
	var currBudget2Owner = hierRec.getFieldValue('custrecord_poapv_owner2');
	var currBudget1Owner = hierRec.getFieldValue('custrecord_poapv_owner1');
	
	var cfoThreshold = hierRec.getFieldValue('custrecord_poapv_cfo_threshold');
	var controllerThreshold = hierRec.getFieldValue('custrecord_poapv_controller_threshold');
	var asstCtrlThreshold = hierRec.getFieldValue('custrecord_poapv_asst_ctrl_threshold');
	var budget2Threshold = hierRec.getFieldValue('custrecord_poapv_owner2_threshold');
	var budget1Threshold = hierRec.getFieldValue('custrecord_poapv_owner1_threshold');
	
	var returnValue = ''
	
	if(!inventory) {
		// non-inventory logic
		if(currentApprover == currCEO) {
			returnValue = 'Approved';
		} else if(currentApprover == currCFO) {
			returnValue = threshold >= parseFloat(cfoThreshold) ? currCEO : 'Approved';
		} else if(currentApprover == currCtrl) {
			returnValue = currCFO;
		} else if(currentApprover == currAsstCtrl) {
			returnValue = threshold >= parseFloat(asstCtrlThreshold) ? currCtrl : currCFO;
		} else if(currentApprover == currBudget2Owner) {
			returnValue = threshold >= parseFloat(budget2Threshold) ? currAsstCtrl : currCFO;
		} else if(currentApprover == currBudget1Owner) {
			returnValue = threshold >= parseFloat(budget1Threshold) ? currBudget2Owner : currCFO;
		} else {
			// this must be admin approve the PO
			returnValue = 'Approved';
		}
	} else {
		// inventory logic
		if(currentApprover == currCEO) {
			returnValue = 'Approved';
		} else if(currentApprover == currCFO) {
			returnValue = threshold >= parseFloat(cfoThreshold) ? currCEO : 'Approved';
		} else if(currentApprover == currCtrl) {
			returnValue = threshold >= parseFloat(controllerThreshold) ? currCFO : 'Approved';
		} else if(currentApprover == currAsstCtrl) {
			returnValue = threshold >= parseFloat(asstCtrlThreshold) ? currCtrl : 'Approved';
		} else if(currentApprover == currBudget2Owner) {
			returnValue = threshold >= parseFloat(budget2Threshold) ? currAsstCtrl : 'Approved';
		} else if(currentApprover == currBudget1Owner) {
			returnValue = threshold >= parseFloat(budget1Threshold) ? currBudget2Owner : 'Approved';
		} else {
			returnValue = '';
		}
	}
	
	return returnValue;
	
}
