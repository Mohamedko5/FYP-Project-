class ApiEndpoints {
  static const mobileLogin = '/api/mobile/auth/login/';
  static const mobileRefresh = '/api/mobile/auth/refresh/';
  static const mobileLogout = '/api/mobile/auth/logout/';
  static const mobileMe = '/api/mobile/me/';
  static const homeSummary = '/api/mobile/home-summary/';
  static const products = '/api/mobile/products/';
  static const orders = '/api/mobile/orders/';
  static const invoices = '/api/mobile/invoices/';
  static const shipments = '/api/mobile/shipments/';

  static String productDetail(int id) => '/api/mobile/products/$id/';
  static String orderDetail(int id) => '/api/mobile/orders/$id/';
  static String invoiceDetail(int id) => '/api/mobile/invoices/$id/';
  static String shipmentDetail(int id) => '/api/mobile/shipments/$id/';
}
