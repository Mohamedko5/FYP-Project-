import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'Bayad Customer'**
  String get appTitle;

  /// No description provided for @companyName.
  ///
  /// In en, this message translates to:
  /// **'Bayad Commercial Activities Company'**
  String get companyName;

  /// No description provided for @systemName.
  ///
  /// In en, this message translates to:
  /// **'Integrated Agricultural Trading System'**
  String get systemName;

  /// No description provided for @splashLoading.
  ///
  /// In en, this message translates to:
  /// **'Preparing customer portal...'**
  String get splashLoading;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @loginTitle.
  ///
  /// In en, this message translates to:
  /// **'Customer Login'**
  String get loginTitle;

  /// No description provided for @loginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to access your Bayad customer account.'**
  String get loginSubtitle;

  /// No description provided for @emailAddress.
  ///
  /// In en, this message translates to:
  /// **'Email Address'**
  String get emailAddress;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @enterEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter email address'**
  String get enterEmail;

  /// No description provided for @enterPassword.
  ///
  /// In en, this message translates to:
  /// **'Enter password'**
  String get enterPassword;

  /// No description provided for @showPassword.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get showPassword;

  /// No description provided for @hidePassword.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get hidePassword;

  /// No description provided for @login.
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get login;

  /// No description provided for @signingIn.
  ///
  /// In en, this message translates to:
  /// **'Signing in...'**
  String get signingIn;

  /// No description provided for @forgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot Password?'**
  String get forgotPassword;

  /// No description provided for @createAccount.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get createAccount;

  /// No description provided for @newToBayad.
  ///
  /// In en, this message translates to:
  /// **'New to Bayad?'**
  String get newToBayad;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @account.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get account;

  /// No description provided for @home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// No description provided for @loadingHome.
  ///
  /// In en, this message translates to:
  /// **'Loading your customer portal...'**
  String get loadingHome;

  /// No description provided for @homeLoadError.
  ///
  /// In en, this message translates to:
  /// **'Unable to load Home. Please try again.'**
  String get homeLoadError;

  /// No description provided for @quickActions.
  ///
  /// In en, this message translates to:
  /// **'Quick Actions'**
  String get quickActions;

  /// No description provided for @browseProducts.
  ///
  /// In en, this message translates to:
  /// **'Browse Products'**
  String get browseProducts;

  /// No description provided for @trackShipments.
  ///
  /// In en, this message translates to:
  /// **'Track Shipments'**
  String get trackShipments;

  /// No description provided for @pendingOrders.
  ///
  /// In en, this message translates to:
  /// **'Pending Orders'**
  String get pendingOrders;

  /// No description provided for @unpaidInvoices.
  ///
  /// In en, this message translates to:
  /// **'Unpaid Invoices'**
  String get unpaidInvoices;

  /// No description provided for @processingShipments.
  ///
  /// In en, this message translates to:
  /// **'Processing Shipments'**
  String get processingShipments;

  /// No description provided for @completedOrders.
  ///
  /// In en, this message translates to:
  /// **'Completed Orders'**
  String get completedOrders;

  /// No description provided for @recentOrders.
  ///
  /// In en, this message translates to:
  /// **'Recent Orders'**
  String get recentOrders;

  /// No description provided for @viewAllOrders.
  ///
  /// In en, this message translates to:
  /// **'View All Orders'**
  String get viewAllOrders;

  /// No description provided for @noOrdersFound.
  ///
  /// In en, this message translates to:
  /// **'No Orders found.'**
  String get noOrdersFound;

  /// No description provided for @unpaidInvoiceNotice.
  ///
  /// In en, this message translates to:
  /// **'You have an unpaid Invoice. Please contact Bayad Company to complete payment.'**
  String get unpaidInvoiceNotice;

  /// No description provided for @adminOfferResponses.
  ///
  /// In en, this message translates to:
  /// **'Admin Offer Responses'**
  String get adminOfferResponses;

  /// No description provided for @offerResponseNotice.
  ///
  /// In en, this message translates to:
  /// **'Bayad Admin has responded to your Offer.'**
  String get offerResponseNotice;

  /// No description provided for @products.
  ///
  /// In en, this message translates to:
  /// **'Products'**
  String get products;

  /// No description provided for @myOrders.
  ///
  /// In en, this message translates to:
  /// **'My Orders'**
  String get myOrders;

  /// No description provided for @myInvoices.
  ///
  /// In en, this message translates to:
  /// **'My Invoices'**
  String get myInvoices;

  /// No description provided for @myShipments.
  ///
  /// In en, this message translates to:
  /// **'My Shipments'**
  String get myShipments;

  /// No description provided for @customerCode.
  ///
  /// In en, this message translates to:
  /// **'Customer Code'**
  String get customerCode;

  /// No description provided for @customerName.
  ///
  /// In en, this message translates to:
  /// **'Customer Name'**
  String get customerName;

  /// No description provided for @phone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get phone;

  /// No description provided for @secondaryPhone.
  ///
  /// In en, this message translates to:
  /// **'Secondary Phone'**
  String get secondaryPhone;

  /// No description provided for @address.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get address;

  /// No description provided for @customerType.
  ///
  /// In en, this message translates to:
  /// **'Customer Type'**
  String get customerType;

  /// No description provided for @greeting.
  ///
  /// In en, this message translates to:
  /// **'Welcome, {name}'**
  String greeting(String name);

  /// No description provided for @phaseOnePlaceholder.
  ///
  /// In en, this message translates to:
  /// **'This customer module will be implemented in the next development phase.'**
  String get phaseOnePlaceholder;

  /// No description provided for @emptyEmail.
  ///
  /// In en, this message translates to:
  /// **'Please enter your email address.'**
  String get emptyEmail;

  /// No description provided for @invalidEmail.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid email address.'**
  String get invalidEmail;

  /// No description provided for @emptyPassword.
  ///
  /// In en, this message translates to:
  /// **'Please enter your password.'**
  String get emptyPassword;

  /// No description provided for @invalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Invalid email or password.'**
  String get invalidCredentials;

  /// No description provided for @inactiveAccount.
  ///
  /// In en, this message translates to:
  /// **'Your customer account is inactive.'**
  String get inactiveAccount;

  /// No description provided for @serverUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Unable to connect to the server.'**
  String get serverUnavailable;

  /// No description provided for @sessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session has expired.'**
  String get sessionExpired;

  /// No description provided for @unknownError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get unknownError;

  /// No description provided for @emptyState.
  ///
  /// In en, this message translates to:
  /// **'No records are available yet.'**
  String get emptyState;

  /// No description provided for @routeError.
  ///
  /// In en, this message translates to:
  /// **'This page is not available.'**
  String get routeError;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'العربية'**
  String get language;

  /// No description provided for @registerTitle.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get registerTitle;

  /// No description provided for @personalInformation.
  ///
  /// In en, this message translates to:
  /// **'Personal Information'**
  String get personalInformation;

  /// No description provided for @fullName.
  ///
  /// In en, this message translates to:
  /// **'Full Name'**
  String get fullName;

  /// No description provided for @fullNameHint.
  ///
  /// In en, this message translates to:
  /// **'Ahmed Mohammed'**
  String get fullNameHint;

  /// No description provided for @businessName.
  ///
  /// In en, this message translates to:
  /// **'Business or Company Name'**
  String get businessName;

  /// No description provided for @optional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get optional;

  /// No description provided for @contactInformation.
  ///
  /// In en, this message translates to:
  /// **'Contact Information'**
  String get contactInformation;

  /// No description provided for @phoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get phoneNumber;

  /// No description provided for @phoneHint.
  ///
  /// In en, this message translates to:
  /// **'+249912345678'**
  String get phoneHint;

  /// No description provided for @addressHint.
  ///
  /// In en, this message translates to:
  /// **'Omdurman, Sudan'**
  String get addressHint;

  /// No description provided for @businessInformation.
  ///
  /// In en, this message translates to:
  /// **'Business Information'**
  String get businessInformation;

  /// No description provided for @accountSecurity.
  ///
  /// In en, this message translates to:
  /// **'Account Security'**
  String get accountSecurity;

  /// No description provided for @confirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm Password'**
  String get confirmPassword;

  /// No description provided for @repeatPassword.
  ///
  /// In en, this message translates to:
  /// **'Repeat password'**
  String get repeatPassword;

  /// No description provided for @acceptTerms.
  ///
  /// In en, this message translates to:
  /// **'I accept the terms'**
  String get acceptTerms;

  /// No description provided for @passwordRequirements.
  ///
  /// In en, this message translates to:
  /// **'Password must include at least 8 characters, uppercase, lowercase, and a number.'**
  String get passwordRequirements;

  /// No description provided for @completeRequiredFields.
  ///
  /// In en, this message translates to:
  /// **'Please complete all required fields.'**
  String get completeRequiredFields;

  /// No description provided for @passwordsDoNotMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match.'**
  String get passwordsDoNotMatch;

  /// No description provided for @submitting.
  ///
  /// In en, this message translates to:
  /// **'Submitting...'**
  String get submitting;

  /// No description provided for @backToLogin.
  ///
  /// In en, this message translates to:
  /// **'Back to Login'**
  String get backToLogin;

  /// No description provided for @farmer.
  ///
  /// In en, this message translates to:
  /// **'Farmer'**
  String get farmer;

  /// No description provided for @investor.
  ///
  /// In en, this message translates to:
  /// **'Investor'**
  String get investor;

  /// No description provided for @consumer.
  ///
  /// In en, this message translates to:
  /// **'Consumer'**
  String get consumer;

  /// No description provided for @exporter.
  ///
  /// In en, this message translates to:
  /// **'Exporter'**
  String get exporter;

  /// No description provided for @factory.
  ///
  /// In en, this message translates to:
  /// **'Factory'**
  String get factory;

  /// No description provided for @supplier.
  ///
  /// In en, this message translates to:
  /// **'Supplier'**
  String get supplier;

  /// No description provided for @emailVerification.
  ///
  /// In en, this message translates to:
  /// **'Email Verification'**
  String get emailVerification;

  /// No description provided for @verificationInstruction.
  ///
  /// In en, this message translates to:
  /// **'Enter the six-digit code sent to {email}.'**
  String verificationInstruction(String email);

  /// No description provided for @verificationCode.
  ///
  /// In en, this message translates to:
  /// **'Verification Code'**
  String get verificationCode;

  /// No description provided for @verifyEmail.
  ///
  /// In en, this message translates to:
  /// **'Verify Email'**
  String get verifyEmail;

  /// No description provided for @verifying.
  ///
  /// In en, this message translates to:
  /// **'Verifying...'**
  String get verifying;

  /// No description provided for @resendCode.
  ///
  /// In en, this message translates to:
  /// **'Resend Code'**
  String get resendCode;

  /// No description provided for @enterSixDigitCode.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit verification code.'**
  String get enterSixDigitCode;

  /// No description provided for @pendingAdminApproval.
  ///
  /// In en, this message translates to:
  /// **'Pending Admin Approval'**
  String get pendingAdminApproval;

  /// No description provided for @pendingApprovalMessage.
  ///
  /// In en, this message translates to:
  /// **'Your email has been verified. Bayad Company will review your account request.'**
  String get pendingApprovalMessage;

  /// No description provided for @checkStatus.
  ///
  /// In en, this message translates to:
  /// **'Check Status'**
  String get checkStatus;

  /// No description provided for @checking.
  ///
  /// In en, this message translates to:
  /// **'Checking...'**
  String get checking;

  /// No description provided for @forgotPasswordInstruction.
  ///
  /// In en, this message translates to:
  /// **'Enter your email address and we will send a secure reset code if the account exists.'**
  String get forgotPasswordInstruction;

  /// No description provided for @sendResetCode.
  ///
  /// In en, this message translates to:
  /// **'Send Reset Code'**
  String get sendResetCode;

  /// No description provided for @sending.
  ///
  /// In en, this message translates to:
  /// **'Sending...'**
  String get sending;

  /// No description provided for @resetCode.
  ///
  /// In en, this message translates to:
  /// **'Reset Code'**
  String get resetCode;

  /// No description provided for @resetCodeInstruction.
  ///
  /// In en, this message translates to:
  /// **'Enter the six-digit reset code sent to {email}.'**
  String resetCodeInstruction(String email);

  /// No description provided for @verifyCode.
  ///
  /// In en, this message translates to:
  /// **'Verify Code'**
  String get verifyCode;

  /// No description provided for @resetPassword.
  ///
  /// In en, this message translates to:
  /// **'Reset Password'**
  String get resetPassword;

  /// No description provided for @newPassword.
  ///
  /// In en, this message translates to:
  /// **'New Password'**
  String get newPassword;

  /// No description provided for @confirmNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm New Password'**
  String get confirmNewPassword;

  /// No description provided for @repeatNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Repeat new password'**
  String get repeatNewPassword;

  /// No description provided for @newPasswordRequirements.
  ///
  /// In en, this message translates to:
  /// **'Use at least 8 characters with uppercase, lowercase, and a number.'**
  String get newPasswordRequirements;

  /// No description provided for @saving.
  ///
  /// In en, this message translates to:
  /// **'Saving...'**
  String get saving;

  /// No description provided for @chat.
  ///
  /// In en, this message translates to:
  /// **'Chat'**
  String get chat;

  /// No description provided for @bayadSupport.
  ///
  /// In en, this message translates to:
  /// **'Bayad Support'**
  String get bayadSupport;

  /// No description provided for @typeAMessage.
  ///
  /// In en, this message translates to:
  /// **'Type a message'**
  String get typeAMessage;

  /// No description provided for @send.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get send;

  /// No description provided for @attachFile.
  ///
  /// In en, this message translates to:
  /// **'Attach File'**
  String get attachFile;

  /// No description provided for @chooseImage.
  ///
  /// In en, this message translates to:
  /// **'Choose Image'**
  String get chooseImage;

  /// No description provided for @choosePdf.
  ///
  /// In en, this message translates to:
  /// **'Choose PDF'**
  String get choosePdf;

  /// No description provided for @shareCustomerCard.
  ///
  /// In en, this message translates to:
  /// **'Share Customer Card'**
  String get shareCustomerCard;

  /// No description provided for @shareCardMessage.
  ///
  /// In en, this message translates to:
  /// **'Your Customer name, code, contact details and account type will be shared with Bayad Admin.'**
  String get shareCardMessage;

  /// No description provided for @shareCard.
  ///
  /// In en, this message translates to:
  /// **'Share Card'**
  String get shareCard;

  /// No description provided for @viewAttachment.
  ///
  /// In en, this message translates to:
  /// **'View Attachment'**
  String get viewAttachment;

  /// No description provided for @downloadAttachment.
  ///
  /// In en, this message translates to:
  /// **'Download Attachment'**
  String get downloadAttachment;

  /// No description provided for @image.
  ///
  /// In en, this message translates to:
  /// **'Image'**
  String get image;

  /// No description provided for @document.
  ///
  /// In en, this message translates to:
  /// **'Document'**
  String get document;

  /// No description provided for @sent.
  ///
  /// In en, this message translates to:
  /// **'Sent'**
  String get sent;

  /// No description provided for @delivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get delivered;

  /// No description provided for @read.
  ///
  /// In en, this message translates to:
  /// **'Read'**
  String get read;

  /// No description provided for @failedToSend.
  ///
  /// In en, this message translates to:
  /// **'Failed to Send'**
  String get failedToSend;

  /// No description provided for @noMessagesYet.
  ///
  /// In en, this message translates to:
  /// **'No Messages Yet'**
  String get noMessagesYet;

  /// No description provided for @startConversation.
  ///
  /// In en, this message translates to:
  /// **'Start a conversation with Bayad Admin.'**
  String get startConversation;

  /// No description provided for @waitingForAdmin.
  ///
  /// In en, this message translates to:
  /// **'Waiting for Admin'**
  String get waitingForAdmin;

  /// No description provided for @waitingForCustomer.
  ///
  /// In en, this message translates to:
  /// **'Waiting for Customer'**
  String get waitingForCustomer;

  /// No description provided for @closed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get closed;

  /// No description provided for @unreadMessages.
  ///
  /// In en, this message translates to:
  /// **'Unread Messages'**
  String get unreadMessages;

  /// No description provided for @bankCardWarning.
  ///
  /// In en, this message translates to:
  /// **'Do not send bank-card numbers, PINs or passwords.'**
  String get bankCardWarning;

  /// No description provided for @noAttachmentSelected.
  ///
  /// In en, this message translates to:
  /// **'No attachment selected'**
  String get noAttachmentSelected;

  /// No description provided for @removeAttachment.
  ///
  /// In en, this message translates to:
  /// **'Remove Attachment'**
  String get removeAttachment;

  /// No description provided for @connectionFallback.
  ///
  /// In en, this message translates to:
  /// **'Messages load through secure server history.'**
  String get connectionFallback;

  /// No description provided for @chooseAttachment.
  ///
  /// In en, this message translates to:
  /// **'Choose Attachment'**
  String get chooseAttachment;

  /// No description provided for @unsupportedFile.
  ///
  /// In en, this message translates to:
  /// **'Choose a JPG, PNG, WebP image or PDF document.'**
  String get unsupportedFile;

  /// No description provided for @shareCustomerCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Share Customer Card'**
  String get shareCustomerCardTitle;

  /// No description provided for @contactBayad.
  ///
  /// In en, this message translates to:
  /// **'Contact Bayad'**
  String get contactBayad;

  /// No description provided for @sellToBayad.
  ///
  /// In en, this message translates to:
  /// **'Sell to Bayad'**
  String get sellToBayad;

  /// No description provided for @supplyOffers.
  ///
  /// In en, this message translates to:
  /// **'Offers'**
  String get supplyOffers;

  /// No description provided for @mySupplyOffers.
  ///
  /// In en, this message translates to:
  /// **'My Offers'**
  String get mySupplyOffers;

  /// No description provided for @product.
  ///
  /// In en, this message translates to:
  /// **'Product'**
  String get product;

  /// No description provided for @unit.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get unit;

  /// No description provided for @quantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get quantity;

  /// No description provided for @createSupplyOffer.
  ///
  /// In en, this message translates to:
  /// **'Create Offer'**
  String get createSupplyOffer;

  /// No description provided for @addOfferItems.
  ///
  /// In en, this message translates to:
  /// **'Add Offer Items'**
  String get addOfferItems;

  /// No description provided for @addProduct.
  ///
  /// In en, this message translates to:
  /// **'Add Product'**
  String get addProduct;

  /// No description provided for @proposedUnitPrice.
  ///
  /// In en, this message translates to:
  /// **'Proposed Unit Price'**
  String get proposedUnitPrice;

  /// No description provided for @proposedTotal.
  ///
  /// In en, this message translates to:
  /// **'Proposed Total'**
  String get proposedTotal;

  /// No description provided for @productLocation.
  ///
  /// In en, this message translates to:
  /// **'Product Location'**
  String get productLocation;

  /// No description provided for @availabilityDate.
  ///
  /// In en, this message translates to:
  /// **'Availability Date'**
  String get availabilityDate;

  /// No description provided for @qualityGrade.
  ///
  /// In en, this message translates to:
  /// **'Quality Grade'**
  String get qualityGrade;

  /// No description provided for @packagingDetails.
  ///
  /// In en, this message translates to:
  /// **'Packaging Details'**
  String get packagingDetails;

  /// No description provided for @uploadProductPhotos.
  ///
  /// In en, this message translates to:
  /// **'Upload Product Photos'**
  String get uploadProductPhotos;

  /// No description provided for @reviewOffer.
  ///
  /// In en, this message translates to:
  /// **'Review Offer'**
  String get reviewOffer;

  /// No description provided for @submitOffer.
  ///
  /// In en, this message translates to:
  /// **'Submit Offer'**
  String get submitOffer;

  /// No description provided for @offerSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Offer Submitted'**
  String get offerSubmitted;

  /// No description provided for @offerDetails.
  ///
  /// In en, this message translates to:
  /// **'Offer Details'**
  String get offerDetails;

  /// No description provided for @offerStatusTimeline.
  ///
  /// In en, this message translates to:
  /// **'Offer Status Timeline'**
  String get offerStatusTimeline;

  /// No description provided for @adminProposedPrice.
  ///
  /// In en, this message translates to:
  /// **'Admin Proposed Price'**
  String get adminProposedPrice;

  /// No description provided for @adminResponse.
  ///
  /// In en, this message translates to:
  /// **'Admin Response'**
  String get adminResponse;

  /// No description provided for @adminResponded.
  ///
  /// In en, this message translates to:
  /// **'Admin Responded'**
  String get adminResponded;

  /// No description provided for @newAdminResponse.
  ///
  /// In en, this message translates to:
  /// **'New Admin Response'**
  String get newAdminResponse;

  /// No description provided for @reviewAdminOffer.
  ///
  /// In en, this message translates to:
  /// **'Review Admin Offer'**
  String get reviewAdminOffer;

  /// No description provided for @customerQuantity.
  ///
  /// In en, this message translates to:
  /// **'Customer Quantity'**
  String get customerQuantity;

  /// No description provided for @adminQuantity.
  ///
  /// In en, this message translates to:
  /// **'Admin Quantity'**
  String get adminQuantity;

  /// No description provided for @customerPrice.
  ///
  /// In en, this message translates to:
  /// **'Customer Price'**
  String get customerPrice;

  /// No description provided for @adminPrice.
  ///
  /// In en, this message translates to:
  /// **'Admin Price'**
  String get adminPrice;

  /// No description provided for @originalTotal.
  ///
  /// In en, this message translates to:
  /// **'Original Total'**
  String get originalTotal;

  /// No description provided for @responseDate.
  ///
  /// In en, this message translates to:
  /// **'Response Date'**
  String get responseDate;

  /// No description provided for @responseExpiry.
  ///
  /// In en, this message translates to:
  /// **'Response Expiry'**
  String get responseExpiry;

  /// No description provided for @customerTotal.
  ///
  /// In en, this message translates to:
  /// **'Customer Total'**
  String get customerTotal;

  /// No description provided for @adminProposedTotal.
  ///
  /// In en, this message translates to:
  /// **'Admin Proposed Total'**
  String get adminProposedTotal;

  /// No description provided for @paymentStatus.
  ///
  /// In en, this message translates to:
  /// **'Payment Status'**
  String get paymentStatus;

  /// No description provided for @paidAmount.
  ///
  /// In en, this message translates to:
  /// **'Paid Amount'**
  String get paidAmount;

  /// No description provided for @waitingFinalApproval.
  ///
  /// In en, this message translates to:
  /// **'Waiting for Final Approval'**
  String get waitingFinalApproval;

  /// No description provided for @paymentCompleted.
  ///
  /// In en, this message translates to:
  /// **'Payment Completed'**
  String get paymentCompleted;

  /// No description provided for @acceptPrice.
  ///
  /// In en, this message translates to:
  /// **'Accept Price'**
  String get acceptPrice;

  /// No description provided for @declinePrice.
  ///
  /// In en, this message translates to:
  /// **'Decline Price'**
  String get declinePrice;

  /// No description provided for @reasonForRejection.
  ///
  /// In en, this message translates to:
  /// **'Reason for Rejection'**
  String get reasonForRejection;

  /// No description provided for @chatAboutThisOffer.
  ///
  /// In en, this message translates to:
  /// **'Chat About This Offer'**
  String get chatAboutThisOffer;

  /// No description provided for @receivingWarehouse.
  ///
  /// In en, this message translates to:
  /// **'Receiving Warehouse'**
  String get receivingWarehouse;

  /// No description provided for @regionState.
  ///
  /// In en, this message translates to:
  /// **'Region or State'**
  String get regionState;

  /// No description provided for @city.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get city;

  /// No description provided for @area.
  ///
  /// In en, this message translates to:
  /// **'Area'**
  String get area;

  /// No description provided for @detailedAddress.
  ///
  /// In en, this message translates to:
  /// **'Detailed Address'**
  String get detailedAddress;

  /// No description provided for @customerReference.
  ///
  /// In en, this message translates to:
  /// **'Customer Reference'**
  String get customerReference;

  /// No description provided for @customerNotes.
  ///
  /// In en, this message translates to:
  /// **'Customer Notes'**
  String get customerNotes;

  /// No description provided for @loadingSupplyOffers.
  ///
  /// In en, this message translates to:
  /// **'Loading offers...'**
  String get loadingSupplyOffers;

  /// No description provided for @loadingProducts.
  ///
  /// In en, this message translates to:
  /// **'Loading products...'**
  String get loadingProducts;

  /// No description provided for @supplyOfferLoadError.
  ///
  /// In en, this message translates to:
  /// **'Unable to load offers.'**
  String get supplyOfferLoadError;

  /// No description provided for @supplyOfferSaveError.
  ///
  /// In en, this message translates to:
  /// **'Unable to save offer.'**
  String get supplyOfferSaveError;

  /// No description provided for @noSupplyOffers.
  ///
  /// In en, this message translates to:
  /// **'No offers yet.'**
  String get noSupplyOffers;

  /// No description provided for @requiredField.
  ///
  /// In en, this message translates to:
  /// **'This field is required.'**
  String get requiredField;

  /// No description provided for @positiveNumberRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter a number greater than zero.'**
  String get positiveNumberRequired;

  /// No description provided for @productRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a product and unit.'**
  String get productRequired;

  /// No description provided for @duplicateProductUnit.
  ///
  /// In en, this message translates to:
  /// **'Duplicate product and unit lines are not allowed.'**
  String get duplicateProductUnit;

  /// No description provided for @saved.
  ///
  /// In en, this message translates to:
  /// **'Saved.'**
  String get saved;

  /// No description provided for @remove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get remove;

  /// No description provided for @supplyOfferNotice.
  ///
  /// In en, this message translates to:
  /// **'Submitting this offer does not guarantee purchase. Bayad Admin will review the products, price and location.'**
  String get supplyOfferNotice;

  /// No description provided for @draft.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get draft;

  /// No description provided for @submitted.
  ///
  /// In en, this message translates to:
  /// **'Submitted'**
  String get submitted;

  /// No description provided for @underReview.
  ///
  /// In en, this message translates to:
  /// **'Under Review'**
  String get underReview;

  /// No description provided for @newPriceProposed.
  ///
  /// In en, this message translates to:
  /// **'New Price Proposed'**
  String get newPriceProposed;

  /// No description provided for @customerAccepted.
  ///
  /// In en, this message translates to:
  /// **'Customer Accepted'**
  String get customerAccepted;

  /// No description provided for @customerDeclined.
  ///
  /// In en, this message translates to:
  /// **'Customer Declined'**
  String get customerDeclined;

  /// No description provided for @approved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get approved;

  /// No description provided for @rejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get rejected;

  /// No description provided for @awaitingProductReceipt.
  ///
  /// In en, this message translates to:
  /// **'Awaiting Product Receipt'**
  String get awaitingProductReceipt;

  /// No description provided for @received.
  ///
  /// In en, this message translates to:
  /// **'Received'**
  String get received;

  /// No description provided for @completed.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get completed;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
