import { Redirect } from 'expo-router';

import { AppRoutes } from '@/core/navigation/routes';

export default function IndexRoute() {
  return <Redirect href={AppRoutes.auth} />;
}
