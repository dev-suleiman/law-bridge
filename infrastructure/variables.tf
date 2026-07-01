variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-north-1"
}

variable "app_name" {
  description = "Application name used for naming resources"
  type        = string
  default     = "lawbridge"
}

variable "github_repo" {
  description = "GitHub repo"
  type        = string
}

variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}
