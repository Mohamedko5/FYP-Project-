class Customer {
  const Customer({
    required this.id,
    required this.code,
    required this.name,
    required this.email,
    required this.phone,
    required this.secondaryPhone,
    required this.address,
    required this.customerType,
  });

  final int id;
  final String code;
  final String name;
  final String email;
  final String phone;
  final String secondaryPhone;
  final String address;
  final String customerType;

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id'] as int? ?? 0,
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      secondaryPhone: json['secondary_phone'] as String? ?? '',
      address: json['address'] as String? ?? '',
      customerType: json['customer_type'] as String? ?? '',
    );
  }
}
