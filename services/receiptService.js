const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

class ReceiptService {
  constructor() {
    this.uploadPath = config.upload.path;
    this.ensureUploadDirectory();
  }

  // Ensure upload directory exists
  async ensureUploadDirectory() {
    try {
      await fs.mkdir(this.uploadPath, { recursive: true });
    } catch (error) {
      logger.error('Error creating upload directory', {
        error: error.message,
        path: this.uploadPath,
      });
    }
  }

  // Generate donation receipt
  async generateReceipt(donationData) {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
      });

      const fileName = `receipt-${donationData.paymentIntentId}-${Date.now()}.pdf`;
      const filePath = path.join(this.uploadPath, fileName);
      const writeStream = require('fs').createWriteStream(filePath);

      doc.pipe(writeStream);

      // Add header
      this.addHeader(doc, donationData);

      // Add receipt details
      this.addReceiptDetails(doc, donationData);

      // Add donation information
      this.addDonationInfo(doc, donationData);

      // Add project information
      this.addProjectInfo(doc, donationData);

      // Add footer
      this.addFooter(doc, donationData);

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          logger.info('Receipt generated successfully', {
            filePath,
            paymentIntentId: donationData.paymentIntentId,
          });
          resolve(filePath);
        });

        writeStream.on('error', (error) => {
          logger.error('Error writing receipt file', {
            error: error.message,
            filePath,
          });
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error generating receipt', {
        error: error.message,
        donationData: {
          paymentIntentId: donationData.paymentIntentId,
        },
      });
      throw new Error('Failed to generate receipt');
    }
  }

  // Add header to receipt
  addHeader(doc, donationData) {
    // Organization logo and name
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#0a0a6b')
       .text('Metrax', { align: 'center' });

    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#666')
       .text('Supporting Indigenous Communities', { align: 'center' });

    doc.moveDown(0.5);

    // Receipt title
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#000')
       .text('DONATION RECEIPT', { align: 'center' });

    doc.moveDown(1);

    // Receipt number and date
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#666');

    doc.text(`Receipt #: ${donationData.paymentIntentId}`, { continued: true });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });

    doc.moveDown(1);
  }

  // Add receipt details
  addReceiptDetails(doc, donationData) {
    // Donor information
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#000')
       .text('Donor Information:');

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#333');

    const donorName = donationData.anonymous ? 'Anonymous Donor' : donationData.donorName;
    doc.text(`Name: ${donorName}`);
    doc.text(`Email: ${donationData.donorEmail}`);

    if (donationData.message) {
      doc.text(`Message: ${donationData.message}`);
    }

    doc.moveDown(1);
  }

  // Add donation information
  addDonationInfo(doc, donationData) {
    // Donation details
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#000')
       .text('Donation Details:');

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#333');

    const amount = this.formatCurrency(donationData.amount);
    doc.text(`Amount: ${amount}`);
    doc.text(`Payment Method: ${donationData.paymentMethod || 'Credit Card'}`);
    doc.text(`Transaction ID: ${donationData.paymentIntentId}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.text(`Time: ${new Date().toLocaleTimeString()}`);

    doc.moveDown(1);
  }

  // Add project information
  addProjectInfo(doc, donationData) {
    // Project details
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#000')
       .text('Project Information:');

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#333');

    doc.text(`Project: ${donationData.projectTitle}`);
    doc.text(`Category: ${donationData.projectCategory || 'Community'}`);
    doc.text(`Location: ${donationData.projectLocation || 'Canada'}`);

    doc.moveDown(1);
  }

  // Add footer
  addFooter(doc, donationData) {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 100;

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#666');

    // Tax information
    doc.text('Tax Information:', 50, footerY);
    doc.fontSize(7);
    doc.text('This receipt is for tax purposes. Please keep this document for your records.', 50, footerY + 15);
    doc.text('Metrax is a registered charitable organization. Your donation may be tax deductible.', 50, footerY + 30);

    // Contact information
    doc.fontSize(8);
    doc.text('Contact Information:', 50, footerY + 50);
    doc.fontSize(7);
    doc.text(`Email: ${config.email.from}`, 50, footerY + 65);
    doc.text(`Website: ${config.frontendUrl}`, 50, footerY + 80);

    // Thank you message
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#0a0a6b')
       .text('Thank you for your generous support!', { align: 'center' });
  }

  // Generate refund receipt
  async generateRefundReceipt(refundData) {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
      });

      const fileName = `refund-${refundData.refundId}-${Date.now()}.pdf`;
      const filePath = path.join(this.uploadPath, fileName);
      const writeStream = require('fs').createWriteStream(filePath);

      doc.pipe(writeStream);

      // Add header
      this.addRefundHeader(doc, refundData);

      // Add refund details
      this.addRefundDetails(doc, refundData);

      // Add original donation info
      this.addOriginalDonationInfo(doc, refundData);

      // Add footer
      this.addFooter(doc, refundData);

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          logger.info('Refund receipt generated successfully', {
            filePath,
            refundId: refundData.refundId,
          });
          resolve(filePath);
        });

        writeStream.on('error', (error) => {
          logger.error('Error writing refund receipt file', {
            error: error.message,
            filePath,
          });
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error generating refund receipt', {
        error: error.message,
        refundData: {
          refundId: refundData.refundId,
        },
      });
      throw new Error('Failed to generate refund receipt');
    }
  }

  // Add refund header
  addRefundHeader(doc, refundData) {
    // Organization logo and name
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#0a0a6b')
       .text('Metrax', { align: 'center' });

    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#666')
       .text('Supporting Indigenous Communities', { align: 'center' });

    doc.moveDown(0.5);

    // Refund title
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor('#e63946')
       .text('REFUND RECEIPT', { align: 'center' });

    doc.moveDown(1);

    // Refund number and date
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#666');

    doc.text(`Refund #: ${refundData.refundId}`, { continued: true });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });

    doc.moveDown(1);
  }

  // Add refund details
  addRefundDetails(doc, refundData) {
    // Refund information
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#000')
       .text('Refund Information:');

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#333');

    doc.text(`Original Amount: ${this.formatCurrency(refundData.originalAmount)}`);
    doc.text(`Refund Amount: ${this.formatCurrency(refundData.refundAmount)}`);
    doc.text(`Refund Reason: ${refundData.reason}`);
    doc.text(`Refund ID: ${refundData.refundId}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);

    doc.moveDown(1);
  }

  // Add original donation info
  addOriginalDonationInfo(doc, refundData) {
    // Original donation details
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#000')
       .text('Original Donation:');

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#333');

    doc.text(`Project: ${refundData.projectTitle}`);
    doc.text(`Original Transaction ID: ${refundData.originalPaymentIntentId}`);
    doc.text(`Original Date: ${new Date(refundData.originalDate).toLocaleDateString()}`);

    doc.moveDown(1);
  }

  // Format currency
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  // Delete receipt file
  async deleteReceipt(filePath) {
    try {
      await fs.unlink(filePath);
      logger.info('Receipt file deleted successfully', { filePath });
    } catch (error) {
      logger.error('Error deleting receipt file', {
        error: error.message,
        filePath,
      });
    }
  }

  // Get receipt file path
  getReceiptPath(paymentIntentId) {
    return path.join(this.uploadPath, `receipt-${paymentIntentId}.pdf`);
  }

  // Check if receipt exists
  async receiptExists(paymentIntentId) {
    try {
      const filePath = this.getReceiptPath(paymentIntentId);
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new ReceiptService(); 