// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Bayad Customer';

  @override
  String get companyName => 'Bayad Commercial Activities Company';

  @override
  String get systemName => 'Integrated Agricultural Trading System';

  @override
  String get splashLoading => 'Preparing customer portal...';

  @override
  String get retry => 'Retry';

  @override
  String get loginTitle => 'Customer Login';

  @override
  String get loginSubtitle => 'Sign in to access your Bayad customer account.';

  @override
  String get emailAddress => 'Email Address';

  @override
  String get password => 'Password';

  @override
  String get enterEmail => 'Enter email address';

  @override
  String get enterPassword => 'Enter password';

  @override
  String get showPassword => 'Show password';

  @override
  String get hidePassword => 'Hide password';

  @override
  String get login => 'Login';

  @override
  String get signingIn => 'Signing in...';

  @override
  String get forgotPassword => 'Forgot Password?';

  @override
  String get createAccount => 'Create Account';

  @override
  String get newToBayad => 'New to Bayad?';

  @override
  String get logout => 'Logout';

  @override
  String get profile => 'Profile';

  @override
  String get account => 'Account';

  @override
  String get home => 'Home';

  @override
  String get loadingHome => 'Loading your customer portal...';

  @override
  String get homeLoadError => 'Unable to load Home. Please try again.';

  @override
  String get quickActions => 'Quick Actions';

  @override
  String get browseProducts => 'Browse Products';

  @override
  String get trackShipments => 'Track Shipments';

  @override
  String get pendingOrders => 'Pending Orders';

  @override
  String get unpaidInvoices => 'Unpaid Invoices';

  @override
  String get processingShipments => 'Processing Shipments';

  @override
  String get completedOrders => 'Completed Orders';

  @override
  String get recentOrders => 'Recent Orders';

  @override
  String get viewAllOrders => 'View All Orders';

  @override
  String get noOrdersFound => 'No Orders found.';

  @override
  String get unpaidInvoiceNotice =>
      'You have an unpaid Invoice. Please contact Bayad Company to complete payment.';

  @override
  String get products => 'Products';

  @override
  String get myOrders => 'My Orders';

  @override
  String get myInvoices => 'My Invoices';

  @override
  String get myShipments => 'My Shipments';

  @override
  String get customerCode => 'Customer Code';

  @override
  String get customerName => 'Customer Name';

  @override
  String get phone => 'Phone';

  @override
  String get secondaryPhone => 'Secondary Phone';

  @override
  String get address => 'Address';

  @override
  String get customerType => 'Customer Type';

  @override
  String greeting(String name) {
    return 'Welcome, $name';
  }

  @override
  String get phaseOnePlaceholder =>
      'This customer module will be implemented in the next development phase.';

  @override
  String get emptyEmail => 'Please enter your email address.';

  @override
  String get invalidEmail => 'Please enter a valid email address.';

  @override
  String get emptyPassword => 'Please enter your password.';

  @override
  String get invalidCredentials => 'Invalid email or password.';

  @override
  String get inactiveAccount => 'Your customer account is inactive.';

  @override
  String get serverUnavailable => 'Unable to connect to the server.';

  @override
  String get sessionExpired => 'Your session has expired.';

  @override
  String get unknownError => 'Something went wrong. Please try again.';

  @override
  String get emptyState => 'No records are available yet.';

  @override
  String get routeError => 'This page is not available.';

  @override
  String get language => 'العربية';

  @override
  String get registerTitle => 'Create Account';

  @override
  String get personalInformation => 'Personal Information';

  @override
  String get fullName => 'Full Name';

  @override
  String get fullNameHint => 'Ahmed Mohammed';

  @override
  String get businessName => 'Business or Company Name';

  @override
  String get optional => 'Optional';

  @override
  String get contactInformation => 'Contact Information';

  @override
  String get phoneNumber => 'Phone Number';

  @override
  String get phoneHint => '+249912345678';

  @override
  String get addressHint => 'Omdurman, Sudan';

  @override
  String get businessInformation => 'Business Information';

  @override
  String get accountSecurity => 'Account Security';

  @override
  String get confirmPassword => 'Confirm Password';

  @override
  String get repeatPassword => 'Repeat password';

  @override
  String get acceptTerms => 'I accept the terms';

  @override
  String get passwordRequirements =>
      'Password must include at least 8 characters, uppercase, lowercase, and a number.';

  @override
  String get completeRequiredFields => 'Please complete all required fields.';

  @override
  String get passwordsDoNotMatch => 'Passwords do not match.';

  @override
  String get submitting => 'Submitting...';

  @override
  String get backToLogin => 'Back to Login';

  @override
  String get farmer => 'Farmer';

  @override
  String get investor => 'Investor';

  @override
  String get consumer => 'Consumer';

  @override
  String get exporter => 'Exporter';

  @override
  String get factory => 'Factory';

  @override
  String get supplier => 'Supplier';

  @override
  String get emailVerification => 'Email Verification';

  @override
  String verificationInstruction(String email) {
    return 'Enter the six-digit code sent to $email.';
  }

  @override
  String get verificationCode => 'Verification Code';

  @override
  String get verifyEmail => 'Verify Email';

  @override
  String get verifying => 'Verifying...';

  @override
  String get resendCode => 'Resend Code';

  @override
  String get enterSixDigitCode => 'Enter the 6-digit verification code.';

  @override
  String get pendingAdminApproval => 'Pending Admin Approval';

  @override
  String get pendingApprovalMessage =>
      'Your email has been verified. Bayad Company will review your account request.';

  @override
  String get checkStatus => 'Check Status';

  @override
  String get checking => 'Checking...';

  @override
  String get forgotPasswordInstruction =>
      'Enter your email address and we will send a secure reset code if the account exists.';

  @override
  String get sendResetCode => 'Send Reset Code';

  @override
  String get sending => 'Sending...';

  @override
  String get resetCode => 'Reset Code';

  @override
  String resetCodeInstruction(String email) {
    return 'Enter the six-digit reset code sent to $email.';
  }

  @override
  String get verifyCode => 'Verify Code';

  @override
  String get resetPassword => 'Reset Password';

  @override
  String get newPassword => 'New Password';

  @override
  String get confirmNewPassword => 'Confirm New Password';

  @override
  String get repeatNewPassword => 'Repeat new password';

  @override
  String get newPasswordRequirements =>
      'Use at least 8 characters with uppercase, lowercase, and a number.';

  @override
  String get saving => 'Saving...';

  @override
  String get chat => 'Chat';

  @override
  String get bayadSupport => 'Bayad Support';

  @override
  String get typeAMessage => 'Type a message';

  @override
  String get send => 'Send';

  @override
  String get attachFile => 'Attach File';

  @override
  String get chooseImage => 'Choose Image';

  @override
  String get choosePdf => 'Choose PDF';

  @override
  String get shareCustomerCard => 'Share Customer Card';

  @override
  String get shareCardMessage =>
      'Your Customer name, code, contact details and account type will be shared with Bayad Admin.';

  @override
  String get shareCard => 'Share Card';

  @override
  String get viewAttachment => 'View Attachment';

  @override
  String get downloadAttachment => 'Download Attachment';

  @override
  String get image => 'Image';

  @override
  String get document => 'Document';

  @override
  String get sent => 'Sent';

  @override
  String get delivered => 'Delivered';

  @override
  String get read => 'Read';

  @override
  String get failedToSend => 'Failed to Send';

  @override
  String get noMessagesYet => 'No Messages Yet';

  @override
  String get startConversation => 'Start a conversation with Bayad Admin.';

  @override
  String get waitingForAdmin => 'Waiting for Admin';

  @override
  String get waitingForCustomer => 'Waiting for Customer';

  @override
  String get closed => 'Closed';

  @override
  String get unreadMessages => 'Unread Messages';

  @override
  String get bankCardWarning =>
      'Do not send bank-card numbers, PINs or passwords.';

  @override
  String get noAttachmentSelected => 'No attachment selected';

  @override
  String get removeAttachment => 'Remove Attachment';

  @override
  String get connectionFallback =>
      'Messages load through secure server history.';

  @override
  String get chooseAttachment => 'Choose Attachment';

  @override
  String get unsupportedFile =>
      'Choose a JPG, PNG, WebP image or PDF document.';

  @override
  String get shareCustomerCardTitle => 'Share Customer Card';

  @override
  String get contactBayad => 'Contact Bayad';

  @override
  String get sellToBayad => 'Sell to Bayad';

  @override
  String get supplyOffers => 'Supply Offers';

  @override
  String get mySupplyOffers => 'My Supply Offers';

  @override
  String get product => 'Product';

  @override
  String get unit => 'Unit';

  @override
  String get quantity => 'Quantity';

  @override
  String get createSupplyOffer => 'Create Supply Offer';

  @override
  String get addOfferItems => 'Add Offer Items';

  @override
  String get addProduct => 'Add Product';

  @override
  String get proposedUnitPrice => 'Proposed Unit Price';

  @override
  String get proposedTotal => 'Proposed Total';

  @override
  String get productLocation => 'Product Location';

  @override
  String get availabilityDate => 'Availability Date';

  @override
  String get qualityGrade => 'Quality Grade';

  @override
  String get packagingDetails => 'Packaging Details';

  @override
  String get uploadProductPhotos => 'Upload Product Photos';

  @override
  String get reviewOffer => 'Review Offer';

  @override
  String get submitOffer => 'Submit Offer';

  @override
  String get offerSubmitted => 'Offer Submitted';

  @override
  String get offerDetails => 'Offer Details';

  @override
  String get offerStatusTimeline => 'Offer Status Timeline';

  @override
  String get adminProposedPrice => 'Admin Proposed Price';

  @override
  String get acceptPrice => 'Accept Price';

  @override
  String get declinePrice => 'Decline Price';

  @override
  String get chatAboutThisOffer => 'Chat About This Offer';

  @override
  String get receivingWarehouse => 'Receiving Warehouse';

  @override
  String get regionState => 'Region or State';

  @override
  String get city => 'City';

  @override
  String get area => 'Area';

  @override
  String get detailedAddress => 'Detailed Address';

  @override
  String get customerReference => 'Customer Reference';

  @override
  String get customerNotes => 'Customer Notes';

  @override
  String get loadingSupplyOffers => 'Loading supply offers...';

  @override
  String get loadingProducts => 'Loading products...';

  @override
  String get supplyOfferLoadError => 'Unable to load supply offers.';

  @override
  String get supplyOfferSaveError => 'Unable to save supply offer.';

  @override
  String get noSupplyOffers => 'No supply offers yet.';

  @override
  String get requiredField => 'This field is required.';

  @override
  String get positiveNumberRequired => 'Enter a number greater than zero.';

  @override
  String get productRequired => 'Please select a product and unit.';

  @override
  String get duplicateProductUnit =>
      'Duplicate product and unit lines are not allowed.';

  @override
  String get saved => 'Saved.';

  @override
  String get remove => 'Remove';

  @override
  String get supplyOfferNotice =>
      'Submitting this offer does not guarantee purchase. Bayad Admin will review the products, price and location.';

  @override
  String get draft => 'Draft';

  @override
  String get submitted => 'Submitted';

  @override
  String get underReview => 'Under Review';

  @override
  String get newPriceProposed => 'New Price Proposed';

  @override
  String get customerAccepted => 'Customer Accepted';

  @override
  String get customerDeclined => 'Customer Declined';

  @override
  String get approved => 'Approved';

  @override
  String get rejected => 'Rejected';

  @override
  String get awaitingProductReceipt => 'Awaiting Product Receipt';

  @override
  String get received => 'Received';

  @override
  String get completed => 'Completed';
}
