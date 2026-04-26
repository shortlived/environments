variable "REPO" {
  default = "lynsei"
}
variable "PROGRAM" {
  default = "new-program"
}
variable "TAG" {
  default = "local"
}
target "package" {
  context = "."
  dockerfile = "Dockerfile.package"
  tags = ["${REPO}/${PROGRAM}:${TAG}"]
  no-cache = true
  platforms = ["linux/arm64","linux/amd64"]
}