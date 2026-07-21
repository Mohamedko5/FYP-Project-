import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/route_names.dart';
import '../../../shared/data/mobile_providers.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/customer_widgets.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../cart/presentation/cart_controller.dart';

class ProductsScreen extends ConsumerWidget {
  const ProductsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(productsProvider);
    final isArabic = Directionality.of(context) == TextDirection.rtl;
    return AppScaffold(
      title: 'Products',
      currentIndex: 1,
      actions: [IconButton(onPressed: () => context.goNamed(RouteNames.cart), icon: const Icon(Icons.shopping_cart_outlined))],
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search products'),
              onChanged: (value) => ref.read(productSearchProvider.notifier).state = value,
            ),
          ),
          Expanded(
            child: products.when(
              loading: () => const LoadingView(message: 'Loading Products...'),
              error: (error, _) => ErrorView(message: 'Unable to load Products. Please try again.', retryLabel: 'Retry', onRetry: () => ref.invalidate(productsProvider)),
              data: (page) => page.results.isEmpty
                  ? const EmptyView(message: 'No Products found.')
                  : RefreshIndicator(
                      onRefresh: () async => ref.refresh(productsProvider.future),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        itemCount: page.results.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final product = page.results[index];
                          return ProductCard(
                            product: product,
                            isArabic: isArabic,
                            onDetails: () => context.goNamed(RouteNames.productDetail, pathParameters: {'id': '${product.id}'}),
                            onAdd: () {
                              final unit = product.units.firstWhere((unit) => unit.isAvailable, orElse: () => product.units.first);
                              ref.read(cartControllerProvider.notifier).add(product, unit, 1);
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Added to Cart')));
                            },
                          );
                        },
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.productId});
  final int productId;
  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  int? _unitId;
  final _qty = TextEditingController(text: '1');

  @override
  void dispose() {
    _qty.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final product = ref.watch(productDetailProvider(widget.productId));
    final isArabic = Directionality.of(context) == TextDirection.rtl;
    return AppScaffold(
      title: 'Product Details',
      currentIndex: 1,
      actions: [IconButton(onPressed: () => context.goNamed(RouteNames.cart), icon: const Icon(Icons.shopping_cart_outlined))],
      child: product.when(
        loading: () => const LoadingView(message: 'Loading Product...'),
        error: (error, _) => ErrorView(message: 'Unable to load Product. Please try again.', retryLabel: 'Retry', onRetry: () => ref.invalidate(productDetailProvider(widget.productId))),
        data: (item) {
          final selected = item.units.where((unit) => unit.id == (_unitId ?? item.units.firstOrNull?.id)).firstOrNull;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(height: 140, decoration: BoxDecoration(color: const Color(0xFFF5F0E8), borderRadius: BorderRadius.circular(12)), child: const Center(child: Icon(Icons.grass, size: 54))),
                    const SizedBox(height: 16),
                    Text(item.localizedName(isArabic), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Directionality(textDirection: TextDirection.ltr, child: Text(item.code)),
                    const SizedBox(height: 12),
                    Text(item.description),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<int>(
                      initialValue: selected?.id,
                      decoration: const InputDecoration(labelText: 'Unit'),
                      items: [for (final unit in item.units) DropdownMenuItem(value: unit.id, child: Text('${unit.unit} • ${formatMoney(unit.sellingPrice)}'))],
                      onChanged: (value) => setState(() => _unitId = value),
                    ),
                    const SizedBox(height: 12),
                    TextField(controller: _qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: selected == null || !selected.isAvailable
                          ? null
                          : () {
                              final qty = double.tryParse(_qty.text) ?? 0;
                              if (qty <= 0) return;
                              ref.read(cartControllerProvider.notifier).add(item, selected, qty);
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Added to Cart')));
                            },
                      child: const Text('Add to Cart'),
                    ),
                  ]),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
