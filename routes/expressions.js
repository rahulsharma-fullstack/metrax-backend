const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { sanitizeInput, validateRequest } = require('../middleware/security');
const resendEmailService = require('../services/resendEmailService');

// Mock database - in a real app, this would be your database
let expressions = [];
let nextId = 1;

// Get all expressions of interest
router.get('/', (req, res) => {
  try {
    logger.info('Fetching all expressions of interest');
    res.json({
      success: true,
      data: expressions,
      count: expressions.length
    });
  } catch (error) {
    logger.error('Error fetching expressions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expressions of interest'
    });
  }
});

// Create new expression of interest
router.post('/', sanitizeInput, validateRequest, (req, res) => {
  try {
    const {
      community_name,
      contact_name,
      contact_email,
      contact_phone,
      contact_title,
      home_model_id,
      home_model_name,
      program_type,
      preferred_timeline,
      estimated_families,
      assessment_completed,
      technical_capacity,
      funding_status,
      comments,
      newsletter_signup,
      authorization_confirmed
    } = req.body;

    // Basic validation
    if (!community_name || !contact_name || !contact_email || !home_model_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: community_name, contact_name, contact_email, home_model_id'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    const newExpression = {
      id: nextId++,
      home_model_id,
      home_model_name: home_model_name || null,
      home_model_specs: {
        squareFeet: null, // Would need to fetch from home model data
        beds: null,
        baths: null
      },
      community_details: {
        name: community_name,
        province: null, // Add province field to request data
        address: null // Add address field to request data
      },
      coordinator: {
        name: contact_name,
        phone: contact_phone || null,
        email: contact_email
      },
      program_details: {
        membersToEnroll: estimated_families || null,
        programDuration: preferred_timeline || null,
        homesPerYear: null, // Add this to request data
        totalHomesOverFiveYears: null // Add this to request data
      },
      project_assessment: {
        landsIdentified: assessment_completed || false,
        siteSurveyCompleted: false, // Add these fields to request
        soilStudyCompleted: false,
        architecturalDesignSelected: false,
        constructionFundsAvailable: funding_status === 'available',
        educationFundsAvailable: false
      },
      comments: comments || null,
      newsletter_signup: newsletter_signup || false,
      newsletter_email: contact_email,
      submitted_at: new Date().toISOString(),
      status: 'pending',
      authorized: authorization_confirmed || false,
      admin_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    expressions.push(newExpression);

    logger.info('New expression of interest created', {
      id: newExpression.id,
      community: community_name,
      contact: contact_email
    });

    res.status(201).json({
      success: true,
      data: newExpression,
      message: 'Expression of interest submitted successfully'
    });

  } catch (error) {
    logger.error('Error creating expression:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit expression of interest'
    });
  }
});

// POST /expressions-of-interest/send-notification - Send admin notification for new expression of interest
router.post('/send-notification', async (req, res) => {
  try {
    const data = req.body;
    // Basic required fields check
    if (!data.communityName || !data.coordinatorName || !data.email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: communityName, coordinatorName, email'
      });
    }
    data.submittedAt = data.submittedAt || new Date().toISOString();
    const result = await resendEmailService.sendExpressionNotification(data);
    res.status(200).json({
      success: true,
      message: 'Expression of interest notification email sent successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send expression of interest notification',
      details: error.message
    });
  }
});

// Update expression status and admin notes
router.patch('/:id', sanitizeInput, validateRequest, (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const expressionIndex = expressions.findIndex(exp => exp.id === parseInt(id));
    
    if (expressionIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Expression of interest not found'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'reviewed', 'contacted', 'in_progress', 'approved', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Update the expression
    if (status) expressions[expressionIndex].status = status;
    if (admin_notes !== undefined) expressions[expressionIndex].admin_notes = admin_notes;
    expressions[expressionIndex].updated_at = new Date().toISOString();

    logger.info('Expression of interest updated', {
      id: parseInt(id),
      status: status,
      has_notes: !!admin_notes
    });

    res.json({
      success: true,
      data: expressions[expressionIndex],
      message: 'Expression of interest updated successfully'
    });

  } catch (error) {
    logger.error('Error updating expression:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update expression of interest'
    });
  }
});

// Get single expression by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const expression = expressions.find(exp => exp.id === parseInt(id));
    
    if (!expression) {
      return res.status(404).json({
        success: false,
        error: 'Expression of interest not found'
      });
    }

    res.json({
      success: true,
      data: expression
    });

  } catch (error) {
    logger.error('Error fetching expression:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expression of interest'
    });
  }
});

// Delete expression (admin only)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const expressionIndex = expressions.findIndex(exp => exp.id === parseInt(id));
    
    if (expressionIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Expression of interest not found'
      });
    }

    const deletedExpression = expressions.splice(expressionIndex, 1)[0];

    logger.info('Expression of interest deleted', {
      id: parseInt(id),
      community: deletedExpression.community_name
    });

    res.json({
      success: true,
      message: 'Expression of interest deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting expression:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete expression of interest'
    });
  }
});

module.exports = router;
