import { supabase } from './utils/supabaseClient.js';

async function testCommunityRoutes() {
  console.log('🔍 Testing community routes image display...');
  
  try {
    // 1. 从数据库获取上传的路线
    const { data, error } = await supabase
      .from('uploaded_routes')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching uploaded routes:', error);
      return;
    }

    console.log(`✅ Found ${data.length} community routes`);
    
    // 2. 分析每条路线的数据
    data.forEach((route, index) => {
      console.log(`\n--- Route ${index + 1}: ${route.name} ---`);
      console.log(`ID: ${route.id}`);
      console.log(`Created by: ${route.user_id}`);
      console.log(`Created at: ${route.created_at}`);
      
      // 检查 route_data 字段
      const routeData = route.route_data || {};
      console.log(`Route data keys: ${Object.keys(routeData).join(', ')}`);
      
      // 检查图片URL
      const imageUrl = routeData.imageUrl || 
                      routeData.cover_url || 
                      routeData.cover_image || 
                      (routeData.waypoints && routeData.waypoints.length > 0 
                        ? routeData.waypoints.find((wp) => wp.imageUrl)?.imageUrl 
                        : null);
      
      console.log(`Image URL found: ${imageUrl ? '✅' : '❌'}`);
      if (imageUrl) {
        console.log(`Image URL: ${imageUrl}`);
      }
      
      // 检查 waypoints
      if (routeData.waypoints && routeData.waypoints.length > 0) {
        console.log(`Waypoints: ${routeData.waypoints.length}`);
        routeData.waypoints.forEach((wp, i) => {
          if (wp.imageUrl) {
            console.log(`  Waypoint ${i + 1} has image: ${wp.imageUrl}`);
          }
        });
      }
    });

    // 3. 测试 fetchUploadedRoutes 函数
    console.log('\n--- Testing fetchUploadedRoutes function ---');
    const { fetchUploadedRoutes } = await import('./services/segmentRoutingService.ts');
    const routes = await fetchUploadedRoutes();
    
    console.log(`Fetched ${routes.length} routes via function`);
    routes.forEach((route, index) => {
      console.log(`Route ${index + 1}: ${route.name}`);
      console.log(`  Image URL: ${route.imageUrl}`);
      console.log(`  Has waypoints: ${(route.waypoints || []).length > 0 ? '✅' : '❌'}`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// 运行测试
testCommunityRoutes().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});