const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

class ResendEmailService {
  constructor() {
    // Validate Resend API key on initialization
    if (!process.env.RESEND_API_KEY) {
      console.error('⚠️ RESEND_API_KEY is not configured in environment variables');
    }
  }

  // Helper method to get environment-specific email configuration
  getEmailConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      isProduction,
      fromAddress: isProduction 
        ? 'Metrax Website <noreply@mail.metraxindigenous.com>' 
        : 'Metrax Website <onboarding@resend.dev>',
      adminEmail: isProduction
        ? ['h.logsend@metraxindigenous.com']
        : ['h.logsend@metraxindigenous.com']
    };
  }
  async sendContactNotification(contactData) {
    try {
      const { name, email, subject, message, submittedAt } = contactData;

      // Validate required fields
      if (!name || !email || !subject) {
        throw new Error('Missing required fields: name, email, or subject');
      }

      const { isProduction, fromAddress, adminEmail } = this.getEmailConfig();

      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: adminEmail,
        subject: `🔔 ${isProduction ? '' : '[TEST] '}New Contact Form Submission: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            ${!isProduction ? `
            <div style="background-color: #f59e0b; color: white; padding: 10px; text-align: center; border-radius: 6px; margin-bottom: 10px;">
              <strong>⚠️ TEST MODE - This email would normally go to info@metraxindigenous.com</strong>
            </div>
            ` : ''}
            
            <div style="background-color: #0a0a6b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">📧 New Contact Form Submission</h1>
            </div>
            
            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="border-left: 4px solid #0a0a6b; padding-left: 20px; margin-bottom: 30px;">
                <h2 style="color: #0a0a6b; margin: 0 0 10px 0;">Contact Details</h2>
                <p style="margin: 5px 0; color: #666;"><strong>Name:</strong> ${name}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #0a0a6b;">${email}</a></p>
                <p style="margin: 5px 0; color: #666;"><strong>Subject:</strong> ${subject}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString()}</p>
                ${!isProduction ? `<p style="margin: 10px 0; padding: 10px; background-color: #fef3c7; color: #92400e; border-radius: 4px; font-size: 14px;"><strong>Note:</strong> In production, this would be sent to info@metraxindigenous.com</p>` : ''}
              </div>

              ${message ? `
              <div style="border-left: 4px solid #10b981; padding-left: 20px; margin-bottom: 30px;">
                <h3 style="color: #10b981; margin: 0 0 15px 0;">Message</h3>
                <div style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; color: #1f2937; line-height: 1.6;">
                  ${message.replace(/\n/g, '<br>')}
                </div>
              </div>
              ` : ''}

              <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <h3 style="color: #374151; margin: 0 0 15px 0;">🚀 Quick Actions</h3>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  <a href="mailto:${email}?subject=Re: ${subject}" 
                     style="background-color: #0a0a6b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                    📧 Reply to ${name}
                  </a>
                  <a href="${process.env.ADMIN_PANEL_URL || 'http://localhost:5173'}/admin/contact-submissions" 
                     style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                    🔧 Manage in Admin Panel
                  </a>
                </div>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
                <p>This email was automatically generated when someone submitted the contact form on your website.</p>
                <p style="margin: 5px 0;">
                  <strong>Metrax Indigenous</strong> • Building Communities • Training Students
                </p>
                ${!isProduction ? `<p style="margin: 10px 0; color: #f59e0b;"><strong>Testing Mode:</strong> Emails are sent to your verified address only</p>` : ''}
              </div>
            </div>
          </div>
        `,
        text: `
${!isProduction ? '⚠️ TEST MODE - This email would normally go to info@metraxindigenous.com\n\n' : ''}New Contact Form Submission

Name: ${name}
Email: ${email}
Subject: ${subject}
Submitted: ${new Date(submittedAt).toLocaleString()}

${message ? `Message:\n${message}` : 'No message provided.'}

Reply to this inquiry: mailto:${email}?subject=Re: ${subject}
Manage in admin panel: ${process.env.ADMIN_PANEL_URL || 'http://localhost:5173'}/admin/contact-submissions

${!isProduction ? '\nNote: In production, this would be sent to info@metraxindigenous.com' : ''}
        `
      });

      if (error) {
        console.error('Resend error:', error);
        throw new Error(`Failed to send email: ${error.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending contact notification:', error);
      throw error;
    }
  }

  async sendDonationNotification(donationData) {
    try {
      const { donorName, donorEmail, amount, projectTitle, message, submittedAt } = donationData;
      
      // Validate required fields
      if (!donorEmail || !amount || !projectTitle) {
        throw new Error('Missing required fields: donorEmail, amount, or projectTitle');
      }

      const { isProduction, fromAddress, adminEmail } = this.getEmailConfig();
      
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: adminEmail,
        subject: `💸 ${isProduction ? '' : '[TEST] '}New Donation Received: ${projectTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            ${!isProduction ? `
            <div style="background-color: #f59e0b; color: white; padding: 10px; text-align: center; border-radius: 6px; margin-bottom: 10px;">
              <strong>⚠️ TEST MODE</strong>
            </div>
            ` : ''}
            
            <div style="background-color: #0a0a6b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">💸 New Donation Received</h1>
            </div>
            
            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0a0a6b; margin: 20px 0;">
                <h3 style="color: #0a0a6b; margin: 0 0 15px 0;">Donation Details</h3>
                <p style="margin: 5px 0; color: #374151;"><strong>Name:</strong> ${donorName || 'Anonymous'}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Email:</strong> <a href="mailto:${donorEmail}" style="color: #0a0a6b;">${donorEmail}</a></p>
                <p style="margin: 5px 0; color: #374151;"><strong>Amount:</strong> $${amount}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Project:</strong> ${projectTitle}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString()}</p>
                ${message ? `<p style="margin: 15px 0 5px 0; color: #374151;"><strong>Message:</strong></p><p style="font-style: italic; color: #6b7280;">"${message}"</p>` : ''}
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://metraxindigenous.com/admin/donations" 
                   style="background-color: #0a0a6b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                  View in Admin Panel
                </a>
              </div>

              <div style="text-align: center; color: #6b7280; font-size: 14px;">
                <p style="margin: 5px 0;">
                  <strong>Metrax Indigenous</strong><br>
                  Building Communities • Training Students • Creating Futures
                </p>
                ${!isProduction ? '<p style="color: #f59e0b; font-weight: 600;">This is a test notification</p>' : ''}
              </div>
            </div>
          </div>
        `,
        text: `${!isProduction ? '⚠️ TEST MODE\n\n' : ''}New Donation Received\n\nDonor: ${donorName || 'Anonymous'}\nEmail: ${donorEmail}\nAmount: $${amount}\nProject: ${projectTitle}\nMessage: ${message || 'None'}\nSubmitted: ${new Date(submittedAt).toLocaleString()}\n\n${!isProduction ? 'This is a test notification' : ''}`
      });
      
      if (error) {
        console.error('Resend error:', error);
        throw new Error(`Failed to send donation notification: ${error.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending donation notification:', error);
      throw error;
    }
  }

  async sendExpressionNotification(expressionData) {
    try {
      const { communityName, province, address, coordinatorName, phone, email, membersToEnroll, programYears, homesPerYear, totalHomes, landsIdentified, siteSurveyCompleted, soilStudyCompleted, architecturalDesignSelected, constructionFundsAvailable, educationFundsAvailable, comments, submittedAt } = expressionData;
      
      // Validate required fields
      if (!communityName || !coordinatorName || !email) {
        throw new Error('Missing required fields: communityName, coordinatorName, or email');
      }

      const { isProduction, fromAddress, adminEmail } = this.getEmailConfig();
      
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: adminEmail,
        subject: `🏠 ${isProduction ? '' : '[TEST] '}New Home Model Expression of Interest`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <h2>New Expression of Interest</h2>
            <p><strong>Community:</strong> ${communityName}</p>
            <p><strong>Province:</strong> ${province}</p>
            <p><strong>Address:</strong> ${address}</p>
            <p><strong>Coordinator:</strong> ${coordinatorName}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Members to Enroll:</strong> ${membersToEnroll}</p>
            <p><strong>Program Years:</strong> ${programYears}</p>
            <p><strong>Homes Per Year:</strong> ${homesPerYear}</p>
            <p><strong>Total Homes:</strong> ${totalHomes}</p>
            <p><strong>Lands Identified:</strong> ${landsIdentified}</p>
            <p><strong>Site Survey Completed:</strong> ${siteSurveyCompleted}</p>
            <p><strong>Soil Study Completed:</strong> ${soilStudyCompleted}</p>
            <p><strong>Architectural Design Selected:</strong> ${architecturalDesignSelected}</p>
            <p><strong>Construction Funds Available:</strong> ${constructionFundsAvailable}</p>
            <p><strong>Education Funds Available:</strong> ${educationFundsAvailable}</p>
            <p><strong>Comments:</strong> ${comments}</p>
            <p><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString()}</p>
          </div>
        `,
        text: `New Expression of Interest\nCommunity: ${communityName}\nProvince: ${province}\nAddress: ${address}\nCoordinator: ${coordinatorName}\nPhone: ${phone}\nEmail: ${email}\nMembers to Enroll: ${membersToEnroll}\nProgram Years: ${programYears}\nHomes Per Year: ${homesPerYear}\nTotal Homes: ${totalHomes}\nLands Identified: ${landsIdentified}\nSite Survey Completed: ${siteSurveyCompleted}\nSoil Study Completed: ${soilStudyCompleted}\nArchitectural Design Selected: ${architecturalDesignSelected}\nConstruction Funds Available: ${constructionFundsAvailable}\nEducation Funds Available: ${educationFundsAvailable}\nComments: ${comments}\nSubmitted: ${new Date(submittedAt).toLocaleString()}`
      });
      if (error) {
        console.error('Resend error:', error);
        throw new Error(`Failed to send expression notification: ${error.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending expression notification:', error);
      throw error;
    }
  }

  async sendVolunteerNotification(volunteerData) {
    try {
      const { firstName, lastName, email, phone, address, city, province, postalCode, availability, volunteerRoles, experience, skills, motivation, emergencyContact, emergencyPhone, submittedAt } = volunteerData;
      
      // Validate required fields
      if (!firstName || !lastName || !email) {
        throw new Error('Missing required fields: firstName, lastName, or email');
      }

      const { isProduction, fromAddress, adminEmail } = this.getEmailConfig();
      
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: adminEmail,
        subject: `🙋‍♂️ ${isProduction ? '' : '[TEST] '}New Volunteer Application`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <h2>New Volunteer Application</h2>
            <p><strong>Name:</strong> ${firstName} ${lastName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Address:</strong> ${address}, ${city}, ${province}, ${postalCode}</p>
            <p><strong>Availability:</strong> ${availability}</p>
            <p><strong>Volunteer Roles:</strong> ${Array.isArray(volunteerRoles) ? volunteerRoles.join(', ') : volunteerRoles}</p>
            <p><strong>Experience:</strong> ${experience}</p>
            <p><strong>Skills:</strong> ${skills}</p>
            <p><strong>Motivation:</strong> ${motivation}</p>
            <p><strong>Emergency Contact:</strong> ${emergencyContact} (${emergencyPhone})</p>
            <p><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString()}</p>
          </div>
        `,
        text: `${!isProduction ? '⚠️ TEST MODE\n\n' : ''}New Volunteer Application\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone}\nAddress: ${address}, ${city}, ${province}, ${postalCode}\nAvailability: ${availability}\nVolunteer Roles: ${Array.isArray(volunteerRoles) ? volunteerRoles.join(', ') : volunteerRoles}\nExperience: ${experience}\nSkills: ${skills}\nMotivation: ${motivation}\nEmergency Contact: ${emergencyContact} (${emergencyPhone})\nSubmitted: ${new Date(submittedAt).toLocaleString()}\n\n${!isProduction ? 'This is a test notification' : ''}`
      });
      
      if (error) {
        console.error('Resend error:', error);
        throw new Error(`Failed to send volunteer notification: ${error.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending volunteer notification:', error);
      throw error;
    }
  }

  async sendEnrollmentNotification(enrollmentData) {
    try {
      const { courseId, firstName, lastName, email, phone, address, city, province, postalCode, motivation, submittedAt } = enrollmentData;
      
      // Validate required fields
      if (!courseId || !firstName || !lastName || !email) {
        throw new Error('Missing required fields: courseId, firstName, lastName, or email');
      }

      const { isProduction, fromAddress, adminEmail } = this.getEmailConfig();
      
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: adminEmail,
        subject: `📚 ${isProduction ? '' : '[TEST] '}New Course Enrollment`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <h2>New Course Enrollment</h2>
            <p><strong>Course ID:</strong> ${courseId}</p>
            <p><strong>Name:</strong> ${firstName} ${lastName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Address:</strong> ${address}, ${city}, ${province}, ${postalCode}</p>
            <p><strong>Motivation:</strong> ${motivation}</p>
            <p><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString()}</p>
          </div>
        `,
        text: `${!isProduction ? '⚠️ TEST MODE\n\n' : ''}New Course Enrollment\n\nCourse ID: ${courseId}\nName: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone}\nAddress: ${address}, ${city}, ${province}, ${postalCode}\nMotivation: ${motivation}\nSubmitted: ${new Date(submittedAt).toLocaleString()}\n\n${!isProduction ? 'This is a test notification' : ''}`
      });
      
      if (error) {
        console.error('Resend error:', error);
        throw new Error(`Failed to send enrollment notification: ${error.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending enrollment notification:', error);
      throw error;
    }
  }

  // Send donation confirmation email to donor
  async sendDonationConfirmation(donationData) {
    try {
      const { donorName, donorEmail, amount, projectTitle, message, submittedAt, paymentId } = donationData;
      
      // Validate required fields
      if (!donorEmail || !amount || !projectTitle) {
        throw new Error('Missing required fields: donorEmail, amount, or projectTitle');
      }

      const { isProduction } = this.getEmailConfig();
      
      // Use a verified from address for donor emails
      const fromAddress = isProduction 
        ? 'Metrax Indigenous <noreply@mail.metraxindigenous.com>' 
        : 'Metrax Indigenous <onboarding@resend.dev>';
      
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [donorEmail],
        subject: `🙏 Thank you for your donation to ${projectTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            ${!isProduction ? `
            <div style="background-color: #f59e0b; color: white; padding: 10px; text-align: center; border-radius: 6px; margin-bottom: 10px;">
              <strong>⚠️ TEST MODE</strong>
            </div>
            ` : ''}
            
            <div style="background-color: #0a0a6b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">🙏 Thank You for Your Donation!</h1>
            </div>
            
            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="font-size: 18px; color: #0a0a6b; margin-bottom: 20px;">
                Dear ${donorName === 'Anonymous' ? 'Generous Donor' : donorName},
              </p>
              
              <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
                Thank you for your generous donation to support our mission! Your contribution makes a real difference in building stronger Indigenous communities.
              </p>

              <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0a0a6b; margin: 20px 0;">
                <h3 style="color: #0a0a6b; margin: 0 0 15px 0;">Donation Details</h3>
                <p style="margin: 5px 0; color: #374151;"><strong>Amount:</strong> $${amount}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Project:</strong> ${projectTitle}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Date:</strong> ${new Date(submittedAt).toLocaleDateString()}</p>
                ${paymentId ? `<p style="margin: 5px 0; color: #6b7280; font-size: 14px;"><strong>Transaction ID:</strong> ${paymentId}</p>` : ''}
                ${message ? `<p style="margin: 15px 0 5px 0; color: #374151;"><strong>Your Message:</strong></p><p style="font-style: italic; color: #6b7280;">"${message}"</p>` : ''}
              </div>

              <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
                <h3 style="color: #10b981; margin: 0 0 15px 0;">Your Impact</h3>
                <p style="color: #374151; line-height: 1.6; margin: 0;">
                  Your donation directly supports Indigenous communities through education, training, and home-building initiatives. Every dollar helps us create lasting change and build stronger, more sustainable communities.
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://metraxindigenous.com" 
                   style="background-color: #0a0a6b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                  Visit Our Website
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />

              <div style="text-align: center; color: #6b7280; font-size: 14px;">
                <p style="margin: 5px 0;">
                  <strong>Metrax Indigenous</strong><br>
                  Building Communities • Training Students • Creating Futures
                </p>
                <p style="margin: 15px 0 5px 0;">
                  For questions about your donation, please contact us at 
                  <a href="mailto:info@metraxindigenous.com" style="color: #0a0a6b;">info@metraxindigenous.com</a>
                </p>
                ${!isProduction ? '<p style="color: #f59e0b; font-weight: 600;">This is a test email</p>' : ''}
              </div>
            </div>
          </div>
        `,
        text: `
${!isProduction ? '⚠️ TEST MODE\n\n' : ''}Thank You for Your Donation!

Dear ${donorName === 'Anonymous' ? 'Generous Donor' : donorName},

Thank you for your generous donation to support our mission! Your contribution makes a real difference in building stronger Indigenous communities.

Donation Details:
- Amount: $${amount}
- Project: ${projectTitle}
- Date: ${new Date(submittedAt).toLocaleDateString()}
${paymentId ? `- Transaction ID: ${paymentId}` : ''}

${message ? `Your Message: "${message}"` : ''}

Your Impact:
Your donation directly supports Indigenous communities through education, training, and home-building initiatives. Every dollar helps us create lasting change and build stronger, more sustainable communities.

For questions about your donation, please contact us at h.logsend@metraxindigenous.com

Metrax Indigenous
Building Communities • Training Students • Creating Futures
https://metraxindigenous.com

${!isProduction ? 'This is a test email' : ''}
        `
      });

      if (error) {
        console.error('Resend error sending confirmation:', error);
        throw new Error(`Failed to send confirmation email: ${error.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending donation confirmation:', error);
      throw error;
    }
  }

  // Send newsletter subscription notification to admin
  async sendNewsletterNotification(subscriptionData) {
    try {
      const { email, submittedAt } = subscriptionData;

      // Validate required fields
      if (!email) {
        throw new Error('Missing required field: email');
      }

      const { isProduction, fromAddress, adminEmail } = this.getEmailConfig();

      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: adminEmail,
        subject: `📧 ${isProduction ? '' : '[TEST] '}New Newsletter Subscription`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            ${!isProduction ? `
            <div style="background-color: #f59e0b; color: white; padding: 10px; text-align: center; border-radius: 6px; margin-bottom: 10px;">
              <strong>⚠️ TEST MODE - This email would normally go to production admins</strong>
            </div>
            ` : ''}
            
            <div style="background-color: #0a0a6b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">📧 New Newsletter Subscription</h1>
            </div>
            
            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
                A new user has subscribed to the Metrax Indigenous newsletter.
              </p>

              <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0a0a6b; margin: 20px 0;">
                <h3 style="color: #0a0a6b; margin: 0 0 15px 0;">Subscription Details</h3>
                <p style="margin: 5px 0; color: #374151;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Subscribed At:</strong> ${submittedAt ? new Date(submittedAt).toLocaleString() : new Date().toLocaleString()}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Source:</strong> Website Newsletter Form</p>
              </div>

              <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #065f46; margin: 0; font-weight: 500;">
                  📊 Action Required: Add this email to your newsletter distribution list
                </p>
              </div>

              <div style="text-align: center; color: #6b7280; font-size: 14px;">
                <p style="margin: 5px 0;">
                  <strong>Metrax Indigenous</strong><br>
                  Newsletter Management System
                </p>
              </div>
            </div>
          </div>
        `,
        text: `New Newsletter Subscription\n\nA new user has subscribed to the Metrax Indigenous newsletter.\n\nSubscription Details:\n- Email: ${email}\n- Subscribed At: ${submittedAt ? new Date(submittedAt).toLocaleString() : new Date().toLocaleString()}\n- Source: Website Newsletter Form\n\nAction Required: Add this email to your newsletter distribution list\n\nMetrax Indigenous Newsletter Management System`
      });

      if (error) {
        console.error('Resend error sending newsletter notification:', error);
        throw new Error(`Failed to send newsletter notification: ${error.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending newsletter notification:', error);
      throw error;
    }
  }

  // Test email method to verify configuration
  async testEmail(recipientEmail) {
    try {
      if (!recipientEmail) {
        throw new Error('Recipient email is required for testing');
      }

      const { isProduction, fromAddress } = this.getEmailConfig();
      
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [recipientEmail],
        subject: `🧪 ${isProduction ? '' : '[TEST] '}Email Configuration Test`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <div style="background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">🧪 Email Test Successful!</h1>
            </div>
            
            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
                This is a test email to verify that your Resend email configuration is working correctly.
              </p>

              <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0a0a6b; margin: 20px 0;">
                <h3 style="color: #0a0a6b; margin: 0 0 15px 0;">Configuration Details</h3>
                <p style="margin: 5px 0; color: #374151;"><strong>Environment:</strong> ${isProduction ? 'Production' : 'Development'}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>From Address:</strong> ${fromAddress}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Domain:</strong> ${isProduction ? 'mail.metraxindigenous.com' : 'resend.dev'}</p>
              </div>

              <div style="text-align: center; color: #6b7280; font-size: 14px;">
                <p style="margin: 5px 0;">
                  <strong>Metrax Indigenous</strong><br>
                  Email Service Test
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Email Test Successful!\n\nThis is a test email to verify that your Resend email configuration is working correctly.\n\nConfiguration Details:\n- Environment: ${isProduction ? 'Production' : 'Development'}\n- From Address: ${fromAddress}\n- Test Time: ${new Date().toLocaleString()}\n- Domain: ${isProduction ? 'mail.metraxindigenous.com' : 'resend.dev'}\n\nMetrax Indigenous Email Service Test`
      });

      if (error) {
        console.error('Resend error during test:', error);
        throw new Error(`Test email failed: ${error.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending test email:', error);
      throw error;
    }
  }
}

module.exports = new ResendEmailService();
