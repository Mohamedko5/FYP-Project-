import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/mobile_models.dart';

final cartControllerProvider = StateNotifierProvider<CartController, CartState>((ref) => CartController());

class CartState {
  const CartState({this.items = const []});
  final List<CartItem> items;
  bool get isEmpty => items.isEmpty;
  double get subtotal => items.fold(0, (total, item) => total + item.lineTotal);
}

class CartItem {
  const CartItem({required this.product, required this.unit, required this.quantity});
  final Product product;
  final ProductUnitOption unit;
  final double quantity;
  double get lineTotal => quantity * unit.sellingPrice;
  String get key => '${product.id}:${unit.id}';
  CartItem copyWith({double? quantity}) => CartItem(product: product, unit: unit, quantity: quantity ?? this.quantity);
}

class CartController extends StateNotifier<CartState> {
  CartController() : super(const CartState());

  void add(Product product, ProductUnitOption unit, double quantity) {
    final rows = [...state.items];
    final key = '${product.id}:${unit.id}';
    final index = rows.indexWhere((item) => item.key == key);
    if (index >= 0) {
      rows[index] = rows[index].copyWith(quantity: rows[index].quantity + quantity);
    } else {
      rows.add(CartItem(product: product, unit: unit, quantity: quantity));
    }
    state = CartState(items: rows);
  }

  void updateQuantity(String key, double quantity) {
    if (quantity <= 0) {
      remove(key);
      return;
    }
    state = CartState(items: [
      for (final item in state.items) item.key == key ? item.copyWith(quantity: quantity) : item,
    ]);
  }

  void remove(String key) => state = CartState(items: state.items.where((item) => item.key != key).toList());
  void clear() => state = const CartState();
}
