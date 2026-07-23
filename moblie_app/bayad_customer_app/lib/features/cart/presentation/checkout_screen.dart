import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../shared/data/mobile_repository.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/customer_widgets.dart';
import '../../../shared/widgets/empty_view.dart';
import 'cart_controller.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _reference = TextEditingController();
  final _notes = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reference.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final cart = ref.read(cartControllerProvider);
    if (cart.isEmpty || _submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final order = await ref.read(mobileRepositoryProvider).createOrder(
            idempotencyKey: DateTime.now().microsecondsSinceEpoch.toString(),
            customerReference: _reference.text,
            customerNotes: _notes.text,
            items: [
              for (final item in cart.items)
                {'product_id': item.product.id, 'product_unit_id': item.unit.id, 'quantity': item.quantity.toStringAsFixed(3)}
            ],
          );
      ref.read(cartControllerProvider.notifier).clear();
      if (mounted) context.goNamed(RouteNames.orderSuccess, pathParameters: {'id': '${order.id}'});
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartControllerProvider);
    return AppScaffold(
      title: 'Checkout',
      currentIndex: 1,
      child: cart.isEmpty
          ? const EmptyView(message: 'Your cart is empty.')
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('Your Order will be reviewed by Bayad Company before an Invoice is created.'))),
                const SizedBox(height: 12),
                for (final item in cart.items) ListTile(title: Text(item.product.nameEn), subtitle: Text(formatQuantity(item.quantity, item.unit.unit)), trailing: Text(formatMoney(item.lineTotal))),
                const Divider(),
                Row(children: [const Expanded(child: Text('Total')), PriceText(value: cart.subtotal)]),
                const SizedBox(height: 16),
                TextField(controller: _reference, decoration: const InputDecoration(labelText: 'Customer reference')),
                const SizedBox(height: 12),
                TextField(controller: _notes, maxLines: 3, decoration: const InputDecoration(labelText: 'Customer notes')),
                if (_error != null) ...[const SizedBox(height: 12), Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))],
                const SizedBox(height: 16),
                FilledButton(onPressed: _submitting ? null : _submit, child: Text(_submitting ? 'Submitting...' : 'Place Order')),
              ],
            ),
    );
  }
}

class OrderSuccessScreen extends StatelessWidget {
  const OrderSuccessScreen({super.key, required this.orderId});
  final int orderId;

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: 'Order Submitted',
      currentIndex: 3,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle, size: 72, color: Colors.green),
            const SizedBox(height: 16),
            Text('Your Order has been submitted and is waiting for Admin review.', textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 24),
            FilledButton(onPressed: () => context.goNamed(RouteNames.orderDetail, pathParameters: {'id': '$orderId'}), child: const Text('View Order')),
            TextButton(onPressed: () => context.goNamed(RouteNames.home), child: const Text('Return Home')),
          ],
        ),
      ),
    );
  }
}
