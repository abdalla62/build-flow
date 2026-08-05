class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String status;
  final String? avatar;

  const UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.status,
    this.avatar,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      status: (json['status'] ?? 'Active').toString(),
      avatar: json['avatar']?.toString(),
    );
  }

  bool get isAdmin => role == 'Administrator';
  bool get isProcurement => role == 'Procurement Officer';
  bool get isPM => role == 'Project Manager';
  bool get isSE => role == 'Site Engineer';
  bool get isSupplier => role == 'Supplier';
  bool get isAccountant => role == 'Accountant';
  bool get isDelivery => role == 'Delivery Staff';
}
