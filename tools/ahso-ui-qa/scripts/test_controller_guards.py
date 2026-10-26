#!/usr/bin/env python3
"""Regression checks for guard detection, including a real-controller fault injection."""
from pathlib import Path
import tempfile
import unittest

from controller_guards import check_controller_guards

REPO = Path(__file__).resolve().parents[3]


class ControllerGuardsTest(unittest.TestCase):
    def scan(self, source: str, relative: str = "backend/src/example/example.controller.ts") -> list[str]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            file = root / relative
            file.parent.mkdir(parents=True)
            file.write_text(source)
            return check_controller_guards(root)

    def test_unguarded_route_reports_method_path_and_line(self):
        self.assertEqual(self.scan('@Controller("examples")\nexport class Example {\n  @Get(":id")\n  find() {}\n}\n'),
                         ["ERROR guard    backend/src/example/example.controller.ts:3  GET /examples/:id"])

    def test_class_guard_and_method_permissions(self):
        source = '''@Controller("examples")
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard
)
export class Example {
  @RequirePermissions("examples.view")
  @Get()
  find() {}
}'''
        self.assertEqual(self.scan(source), [])

    def test_method_guard_and_public_decorators_in_either_order(self):
        source = '''@Controller("examples")
export class Example {
  @Get("guarded")
  @UseGuards(JwtAuthGuard)
  guarded() {}
  @Public()
  @Post("public-before")
  before() {}
  @Get("public-after")
  @Public()
  after() {}
}'''
        self.assertEqual(self.scan(source), [])

    def test_comment_and_string_decorators_do_not_protect_a_route(self):
        source = '''// @UseGuards(JwtAuthGuard)
@Controller("examples")
export class Example {
  /* @Public() */
  @ApiOperation({ summary: "fake @Public() and closing ) { characters" })
  @Get("real)")
  find(@Body() dto: { name: string }) { return "@Get('fake')"; }
}'''
        findings = self.scan(source)
        self.assertEqual(len(findings), 1)
        self.assertIn("GET /examples/real)", findings[0])
        self.assertTrue(findings[0].startswith("ERROR guard"))

    def test_guard_outside_five_line_class_window_is_not_inferred(self):
        source = '@UseGuards(JwtAuthGuard)\n\n\n\n\n\nexport class Example {\n@Get()\nfind() {}\n}'
        self.assertTrue(self.scan(source)[0].startswith("ERROR guard"))

    def test_jwt_class_without_authorization_warns_but_public_does_not(self):
        source = '''@UseGuards(JwtAuthGuard)
export class Example {
  @Get("private")
  privateRoute() {}
  @Public()
  @Get("public")
  publicRoute() {}
}'''
        findings = self.scan(source)
        self.assertEqual(len(findings), 1)
        self.assertTrue(findings[0].startswith("WARN  guard"))
        self.assertIn("/private", findings[0])

    def test_class_role_metadata_applies_to_its_routes(self):
        self.assertEqual(self.scan('@Roles("ADMIN")\n@UseGuards(JwtAuthGuard, RolesGuard)\nexport class Example {\n@Get()\nfind() {}\n}'), [])

    def test_whitelist_is_limited_to_session_entry_points(self):
        source = '''@Controller("auth")
export class AuthController {
  @Post("login")
  login() {}
  @Post("refresh")
  refresh() {}
  @Post("forgot-password")
  forgot() {}
  @Post("reset-password")
  reset() {}
  @Post("login" + "/unsafe")
  dynamic() {}
  @Get("sessions")
  sessions() {}
}'''
        findings = self.scan(source, "backend/src/auth/auth.controller.ts")
        self.assertEqual(len(findings), 2)
        self.assertTrue(all(item.startswith("ERROR guard") for item in findings))
        self.assertEqual(self.scan('@Controller("health")\nexport class HealthController {\n@Get()\nhealth() {}\n}',
                                   "backend/src/health/health.controller.ts"), [])

    def test_appledouble_files_are_ignored(self):
        self.assertEqual(self.scan('@Controller("examples")\nexport class Example {\n@Get()\nfind() {}\n}',
                                   "backend/src/example/._example.controller.ts"), [])

    def test_removing_guard_from_a_real_controller_is_detected(self):
        # Use an isolated copy: never expose real routes while another agent tests the app.
        relative = "backend/src/materials/materials.controller.ts"
        source = (REPO / relative).read_text()
        self.assertEqual(self.scan(source, relative), [])
        marker = "@UseGuards(JwtAuthGuard, PermissionsGuard)"
        self.assertIn(marker, source)
        findings = self.scan(source.replace(marker, "", 1), relative)
        self.assertTrue(findings)
        self.assertTrue(all(item.startswith("ERROR guard") for item in findings))
        self.assertEqual((REPO / relative).read_text(), source)


if __name__ == "__main__":
    unittest.main()
