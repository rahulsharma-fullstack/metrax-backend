const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

class ResendEmailService {
  async sendContactNotification(contactData) {
    try {
      const { name, email, subject, message, submittedAt } = contactData;

      // Use different "from" addresses based on environment
      const isProduction = process.env.NODE_ENV === 'production';
      const fromAddress = isProduction 
        ? 'Metrax Website <noreply@metraxindigenous.com>' 
        : 'onboarding@resend.dev'; // Resend's test domain

      // IMPORTANT: In test mode, Resend only allows sending to your verified email
      // So we'll send all test emails to your email address
      const toAddress = isProduction
        ? ['info@metraxindigenous.com']
        : ['jemily12313@gmail.com']; // Must be your verified email in test mode

      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: toAddress,
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

      console.log('Contact notification sent successfully:', data);
      return data;
    } catch (error) {
      console.error('Error sending contact notification:', error);
      throw error;
    }
  }

  async sendDonationNotification(donationData) {
    try {
      const { donorName, donorEmail, amount, projectTitle, message, submittedAt } = donationData;
      const isProduction = process.env.NODE_ENV === 'production';
      const fromAddress = isProduction 
        ? 'Metrax Website <noreply@metraxindigenous.com>' 
        : 'onboarding@resend.dev';
      const toAddress = isProduction
        ? ['info@metraxindigenous.com']
        : ['jemily12313@gmail.com'];
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: toAddress,
        subject: `💸 ${isProduction ? '' : '[TEST] '}New Donation Received: ${projectTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <h2>New Donation Received</h2>
            <p><strong>Name:</strong> ${donorName || 'Anonymous'}</p>
            <p><strong>Email:</strong> ${donorEmail}</p>
            <p><strong>Amount:</strong> $${amount}</p>
            <p><strong>Project:</strong> ${projectTitle}</p>
            <p><strong>Message:</strong> ${message || 'None'}</p>
            <p><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString()}</p>
          </div>
        `,
        text: `New Donation Received\nName: ${donorName || 'Anonymous'}\nEmail: ${donorEmail}\nAmount: $${amount}\nProject: ${projectTitle}\nMessage: ${message || 'None'}\nSubmitted: ${new Date(submittedAt).toLocaleString()}`
      });
      if (error) throw new Error(error.message || 'Unknown error');
      return data;
    } catch (error) {
      console.error('Error sending donation notification:', error);
      throw error;
    }
  }

  async sendExpressionNotification(expressionData) {
    try {
      const { communityName, province, address, coordinatorName, phone, email, membersToEnroll, programYears, homesPerYear, totalHomes, landsIdentified, siteSurveyCompleted, soilStudyCompleted, architecturalDesignSelected, constructionFundsAvailable, educationFundsAvailable, comments, submittedAt } = expressionData;
      const isProduction = process.env.NODE_ENV === 'production';
      const fromAddress = isProduction 
        ? 'Metrax Website <noreply@metraxindigenous.com>' 
        : 'onboarding@resend.dev';
      const toAddress = isProduction
        ? ['info@metraxindigenous.com']
        : ['jemily12313@gmail.com'];
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: toAddress,
        subject: `🏠 ${isProduction ? '' : '[TEST] '}New Home Model Expression of Interest` ,
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
      if (error) throw new Error(error.message || 'Unknown error');
      return data;
    } catch (error) {
      console.error('Error sending expression notification:', error);
      throw error;
    }
  }

  async sendVolunteerNotification(volunteerData) {
    try {
      const { firstName, lastName, email, phone, address, city, province, postalCode, availability, volunteerRoles, experience, skills, motivation, emergencyContact, emergencyPhone, submittedAt } = volunteerData;
      const isProduction = process.env.NODE_ENV === 'production';
      const fromAddress = isProduction 
        ? 'Metrax Website <noreply@metraxindigenous.com>' 
        : 'onboarding@resend.dev';
      const toAddress = isProduction
        ? ['info@metraxindigenous.com']
        : ['jemily12313@gmail.com'];
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: toAddress,
        subject: `🙋‍♂️ ${isProduction ? '' : '[TEST] '}New Volunteer Application` ,
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
        text: `New Volunteer Application\nName: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone}\nAddress: ${address}, ${city}, ${province}, ${postalCode}\nAvailability: ${availability}\nVolunteer Roles: ${Array.isArray(volunteerRoles) ? volunteerRoles.join(', ') : volunteerRoles}\nExperience: ${experience}\nSkills: ${skills}\nMotivation: ${motivation}\nEmergency Contact: ${emergencyContact} (${emergencyPhone})\nSubmitted: ${new Date(submittedAt).toLocaleString()}`
      });
      if (error) throw new Error(error.message || 'Unknown error');
      return data;
    } catch (error) {
      console.error('Error sending volunteer notification:', error);
      throw error;
    }
  }

  async sendEnrollmentNotification(enrollmentData) {
    try {
      const { courseId, firstName, lastName, email, phone, address, city, province, postalCode, motivation, submittedAt } = enrollmentData;
      const isProduction = process.env.NODE_ENV === 'production';
      const fromAddress = isProduction 
        ? 'Metrax Website <noreply@metraxindigenous.com>' 
        : 'onboarding@resend.dev';
      const toAddress = isProduction
        ? ['info@metraxindigenous.com']
        : ['jemily12313@gmail.com'];
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: toAddress,
        subject: `📚 ${isProduction ? '' : '[TEST] '}New Course Enrollment` ,
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
        text: `New Course Enrollment\nCourse ID: ${courseId}\nName: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone}\nAddress: ${address}, ${city}, ${province}, ${postalCode}\nMotivation: ${motivation}\nSubmitted: ${new Date(submittedAt).toLocaleString()}`
      });
      if (error) throw new Error(error.message || 'Unknown error');
      return data;
    } catch (error) {
      console.error('Error sending enrollment notification:', error);
      throw error;
    }
  }
}

module.exports = new ResendEmailService();
